import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { invalidatePublicCachesForProfile } from "@/lib/public-cache-invalidation";
import { hasOAuthTokenPair } from "@/utils/google/connection";
import { getCalendarClient } from "@/utils/google/calendar";
import { getDriveClient } from "@/utils/google/drive";
import {
  GOOGLE_INVALID_GRANT_CODE,
  GOOGLE_SCOPE_MISMATCH_CODE,
  isGoogleScopeMismatchError,
} from "@/lib/google-calendar-sync";
import {
  clearGoogleCalendarConnection,
  clearGoogleDriveConnection,
} from "@/lib/google-calendar-reauth";
import { isGoogleInvalidGrantError } from "@/lib/google-oauth-error";

type ConnectedAccountResponse = {
  calendar: {
    connected: boolean;
    email: string | null;
    reconnectRequired?: boolean;
    code?: string;
  };
  drive: {
    connected: boolean;
    email: string | null;
    reconnectRequired?: boolean;
    code?: string;
  };
};

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function resolveCalendarConnection(
  accessToken: string,
  refreshToken: string,
) {
  try {
    const calendar = await getCalendarClient(accessToken, refreshToken);
    // Validate using the same API surface used by sync (events API).
    await calendar.events.list({
      calendarId: "primary",
      maxResults: 1,
      singleEvents: true,
      timeMin: new Date().toISOString(),
    });

    try {
      const primary = await calendar.calendarList.get({ calendarId: "primary" });
      const primaryEmail = normalizeEmail(primary.data.id);
      if (primaryEmail && primaryEmail.includes("@")) {
        return { email: primaryEmail, scopeMismatch: false, invalidGrant: false };
      }

      const list = await calendar.calendarList.list({ maxResults: 20 });
      const selfCalendar = (list.data.items || []).find(
        (item) => item.primary && normalizeEmail(item.id)?.includes("@"),
      );
      return {
        email: normalizeEmail(selfCalendar?.id),
        scopeMismatch: false,
        invalidGrant: false,
      };
    } catch {
      // calendar.events scope is enough for sync, even if calendar list/email lookup is not allowed.
      return { email: null, scopeMismatch: false, invalidGrant: false };
    }
  } catch (error) {
    const invalidGrant = isGoogleInvalidGrantError(error);
    return {
      email: null,
      scopeMismatch: !invalidGrant && isGoogleScopeMismatchError(error),
      invalidGrant,
    };
  }
}

async function resolveDriveEmail(accessToken: string, refreshToken: string) {
  try {
    const { drive } = await getDriveClient(accessToken, refreshToken);
    const about = await drive.about.get({ fields: "user(emailAddress)" });
    return { email: normalizeEmail(about.data.user?.emailAddress), invalidGrant: false };
  } catch (error) {
    return { email: null, invalidGrant: isGoogleInvalidGrantError(error) };
  }
}

function hasMissingColumnError(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message || "")
      : "";
  return (
    message.includes("column") &&
    (message.includes("google_calendar_account_email") ||
      message.includes("google_drive_account_email"))
  );
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const {
      data: profileWithEmailFields,
      error: profileErrorWithEmailFields,
    } = await supabase
      .from("profiles")
      .select(
        "google_access_token, google_refresh_token, google_drive_access_token, google_drive_refresh_token, google_calendar_account_email, google_drive_account_email",
      )
      .eq("id", user.id)
      .maybeSingle();

    let supportsEmailColumns = true;
    let profile = profileWithEmailFields;

    if (profileErrorWithEmailFields && hasMissingColumnError(profileErrorWithEmailFields)) {
      supportsEmailColumns = false;
      const { data: fallbackProfile } = await supabase
        .from("profiles")
        .select(
          "google_access_token, google_refresh_token, google_drive_access_token, google_drive_refresh_token",
        )
        .eq("id", user.id)
        .maybeSingle();
      profile = fallbackProfile
        ? {
            ...fallbackProfile,
            google_calendar_account_email: null,
            google_drive_account_email: null,
          }
        : null;
    }

    const calendarAccessToken = normalizeEmail(profile?.google_access_token);
    const calendarRefreshToken = normalizeEmail(profile?.google_refresh_token);
    const driveAccessToken = normalizeEmail(profile?.google_drive_access_token);
    const driveRefreshToken = normalizeEmail(profile?.google_drive_refresh_token);
    const storedCalendarEmail = normalizeEmail(
      profile?.google_calendar_account_email,
    );
    const storedDriveEmail = normalizeEmail(profile?.google_drive_account_email);

    const calendarConnected = hasOAuthTokenPair(
      calendarAccessToken,
      calendarRefreshToken,
    );
    const driveConnected = hasOAuthTokenPair(
      driveAccessToken,
      driveRefreshToken,
    );

    const responsePayload: ConnectedAccountResponse = {
      calendar: {
        connected: calendarConnected,
        email: calendarConnected ? storedCalendarEmail : null,
      },
      drive: {
        connected: driveConnected,
        email: driveConnected ? storedDriveEmail : null,
      },
    };

    const [calendarConnection, driveConnection] = await Promise.all([
      calendarConnected &&
      !responsePayload.calendar.email &&
      calendarAccessToken &&
      calendarRefreshToken
        ? resolveCalendarConnection(calendarAccessToken, calendarRefreshToken)
        : Promise.resolve({ email: null, scopeMismatch: false, invalidGrant: false }),
      driveConnected &&
      !responsePayload.drive.email &&
      driveAccessToken &&
      driveRefreshToken
        ? resolveDriveEmail(driveAccessToken, driveRefreshToken)
        : Promise.resolve({ email: null, invalidGrant: false }),
    ]);

    if (calendarConnection.invalidGrant) {
      responsePayload.calendar.connected = false;
      responsePayload.calendar.email = null;
      responsePayload.calendar.reconnectRequired = true;
      responsePayload.calendar.code = GOOGLE_INVALID_GRANT_CODE;
      await clearGoogleCalendarConnection(supabase, user.id);
      invalidatePublicCachesForProfile({ userId: user.id });
    } else if (calendarConnection.scopeMismatch) {
      responsePayload.calendar.connected = false;
      responsePayload.calendar.email = null;
      responsePayload.calendar.reconnectRequired = true;
      responsePayload.calendar.code = GOOGLE_SCOPE_MISMATCH_CODE;
      await clearGoogleCalendarConnection(supabase, user.id);
      invalidatePublicCachesForProfile({ userId: user.id });
    } else if (calendarConnection.email) {
      responsePayload.calendar.email = calendarConnection.email;
    }
    if (driveConnection.invalidGrant) {
      responsePayload.drive.connected = false;
      responsePayload.drive.email = null;
      responsePayload.drive.reconnectRequired = true;
      responsePayload.drive.code = GOOGLE_INVALID_GRANT_CODE;
      await clearGoogleDriveConnection(supabase, user.id);
      invalidatePublicCachesForProfile({ userId: user.id });
    } else if (driveConnection.email) {
      responsePayload.drive.email = driveConnection.email;
    }

    if (supportsEmailColumns) {
      const patch: Record<string, string> = {};
      if (
        calendarConnection.email &&
        !calendarConnection.scopeMismatch &&
        !calendarConnection.invalidGrant
      ) {
        patch.google_calendar_account_email = calendarConnection.email;
      }
      if (driveConnection.email && !driveConnection.invalidGrant) {
        patch.google_drive_account_email = driveConnection.email;
      }
      if (Object.keys(patch).length > 0) {
        await supabase.from("profiles").update(patch).eq("id", user.id);
        invalidatePublicCachesForProfile({ userId: user.id });
      }
    }

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error("Connected account lookup error:", error);
    return NextResponse.json(
      {
        calendar: { connected: false, email: null },
        drive: { connected: false, email: null },
      } as ConnectedAccountResponse,
      { status: 200 },
    );
  }
}
