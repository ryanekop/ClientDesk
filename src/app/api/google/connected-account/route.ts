import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
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

    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "google_access_token, google_refresh_token, google_drive_access_token, google_drive_refresh_token",
      )
      .eq("id", user.id)
      .maybeSingle();

    const calendarAccessToken = normalizeEmail(profile?.google_access_token);
    const calendarRefreshToken = normalizeEmail(profile?.google_refresh_token);
    const driveAccessToken = normalizeEmail(profile?.google_drive_access_token);
    const driveRefreshToken = normalizeEmail(profile?.google_drive_refresh_token);

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
        email: null,
      },
      drive: {
        connected: driveConnected,
        email: null,
      },
    };

    const [calendarEmail, driveEmail] = await Promise.all([
      calendarConnected && calendarAccessToken && calendarRefreshToken
        ? resolveCalendarEmail(calendarAccessToken, calendarRefreshToken)
        : Promise.resolve(null),
      driveConnected && driveAccessToken && driveRefreshToken
        ? resolveDriveEmail(driveAccessToken, driveRefreshToken)
        : Promise.resolve(null),
    ]);

    responsePayload.calendar.email = calendarEmail;
    responsePayload.drive.email = driveEmail;

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
