import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { invalidatePublicCachesForProfile } from "@/lib/public-cache-invalidation";
import { hasOAuthTokenPair } from "@/utils/google/connection";
import { getCalendarClient } from "@/utils/google/calendar";
import { getDriveClient } from "@/utils/google/drive";

type ConnectedAccountResponse = {
  calendar: {
    connected: boolean;
    email: string | null;
  };
  drive: {
    connected: boolean;
    email: string | null;
  };
};

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function resolveCalendarEmail(
  accessToken: string,
  refreshToken: string,
) {
  try {
    const calendar = await getCalendarClient(accessToken, refreshToken);
    const primary = await calendar.calendarList.get({ calendarId: "primary" });
    const primaryEmail = normalizeEmail(primary.data.id);
    if (primaryEmail && primaryEmail.includes("@")) {
      return primaryEmail;
    }

    const list = await calendar.calendarList.list({ maxResults: 20 });
    const selfCalendar = (list.data.items || []).find(
      (item) => item.primary && normalizeEmail(item.id)?.includes("@"),
    );
    return normalizeEmail(selfCalendar?.id);
  } catch {
    return null;
  }
}

async function resolveDriveEmail(accessToken: string, refreshToken: string) {
  try {
    const { drive } = await getDriveClient(accessToken, refreshToken);
    const about = await drive.about.get({ fields: "user(emailAddress)" });
    return normalizeEmail(about.data.user?.emailAddress);
  } catch {
    return null;
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

    const [calendarEmail, driveEmail] = await Promise.all([
      calendarConnected &&
      !responsePayload.calendar.email &&
      calendarAccessToken &&
      calendarRefreshToken
        ? resolveCalendarEmail(calendarAccessToken, calendarRefreshToken)
        : Promise.resolve(null),
      driveConnected &&
      !responsePayload.drive.email &&
      driveAccessToken &&
      driveRefreshToken
        ? resolveDriveEmail(driveAccessToken, driveRefreshToken)
        : Promise.resolve(null),
    ]);

    if (calendarEmail) {
      responsePayload.calendar.email = calendarEmail;
    }
    if (driveEmail) {
      responsePayload.drive.email = driveEmail;
    }

    if (supportsEmailColumns) {
      const patch: Record<string, string> = {};
      if (calendarEmail) {
        patch.google_calendar_account_email = calendarEmail;
      }
      if (driveEmail) {
        patch.google_drive_account_email = driveEmail;
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
