import { google } from "googleapis";

export function getOAuth2Client() {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/google/callback`
    );
}

export function getAuthUrl() {
    const oauth2Client = getOAuth2Client();
    return oauth2Client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: [
            "https://www.googleapis.com/auth/calendar.events",
        ],
    });
}

export async function getCalendarClient(accessToken: string, refreshToken: string) {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
    });
    return google.calendar({ version: "v3", auth: oauth2Client });
}

export async function pushEventToCalendar(
    accessToken: string,
    refreshToken: string,
    event: {
        summary: string;
        description?: string;
        start: Date;
        end: Date;
    }
) {
    const calendar = await getCalendarClient(accessToken, refreshToken);

    const res = await calendar.events.insert({
        calendarId: "primary",
        requestBody: {
            summary: event.summary,
            description: event.description || "",
            start: {
                dateTime: event.start.toISOString(),
                timeZone: "Asia/Jakarta",
            },
            end: {
                dateTime: event.end.toISOString(),
                timeZone: "Asia/Jakarta",
            },
        },
    });

    return res.data;
}
