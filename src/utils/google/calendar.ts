import { google, type calendar_v3 } from "googleapis";
import type { GoogleCalendarDateTime } from "@/utils/google/template";
import { GOOGLE_TEMPLATE_TIMEZONE } from "@/utils/google/template";

export function getOAuth2Client() {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/google/callback`
    );
}

export function getAuthUrl(options?: { state?: string | null }) {
    const oauth2Client = getOAuth2Client();
    return oauth2Client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/calendar.events",
        ],
        state: options?.state || undefined,
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

type CalendarEventPayload = {
    summary: string;
    description?: string;
    location?: string;
    start: GoogleCalendarDateTime;
    end: GoogleCalendarDateTime;
    attendees?: string[];
};

function normalizeAttendees(attendees?: string[]) {
    return (attendees || [])
        .filter(email => email && email.includes("@"))
        .map(email => ({ email }));
}

function buildEventRequestBody(event: CalendarEventPayload) {
    const attendeesList = normalizeAttendees(event.attendees);
    const location = event.location?.trim();

    return {
        summary: event.summary,
        description: event.description || "",
        ...(location && location !== "-" ? { location } : {}),
        start: {
            dateTime: event.start.dateTime,
            timeZone: event.start.timeZone || GOOGLE_TEMPLATE_TIMEZONE,
        },
        end: {
            dateTime: event.end.dateTime,
            timeZone: event.end.timeZone || GOOGLE_TEMPLATE_TIMEZONE,
        },
        attendees: attendeesList,
    };
}

export async function createCalendarEvent(
    accessToken: string,
    refreshToken: string,
    event: CalendarEventPayload,
) {
    const calendar = await getCalendarClient(accessToken, refreshToken);
    const attendeesList = normalizeAttendees(event.attendees);

    const res = await calendar.events.insert({
        calendarId: "primary",
        sendUpdates: attendeesList.length > 0 ? "all" : "none",
        requestBody: buildEventRequestBody(event),
    });

    return res.data;
}

export async function updateCalendarEvent(
    accessToken: string,
    refreshToken: string,
    eventId: string,
    event: CalendarEventPayload,
) {
    const calendar = await getCalendarClient(accessToken, refreshToken);
    const attendeesList = normalizeAttendees(event.attendees);

    const res = await calendar.events.update({
        calendarId: "primary",
        eventId,
        sendUpdates: attendeesList.length > 0 ? "all" : "none",
        requestBody: buildEventRequestBody(event),
    });

    return res.data;
}

export async function deleteCalendarEvent(
    accessToken: string,
    refreshToken: string,
    eventId: string,
) {
    const calendar = await getCalendarClient(accessToken, refreshToken);
    await calendar.events.delete({
        calendarId: "primary",
        eventId,
        sendUpdates: "none",
    });
}

export async function upsertCalendarEvent(
    accessToken: string,
    refreshToken: string,
    event: CalendarEventPayload & { eventId?: string },
): Promise<calendar_v3.Schema$Event> {
    if (event.eventId) {
        try {
            return await updateCalendarEvent(
                accessToken,
                refreshToken,
                event.eventId,
                event,
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : "";
            if (!message.includes("Not Found")) {
                throw error;
            }
        }
    }

    return createCalendarEvent(accessToken, refreshToken, event);
}

export async function pushEventToCalendar(
    accessToken: string,
    refreshToken: string,
    event: CalendarEventPayload,
) {
    return createCalendarEvent(accessToken, refreshToken, event);
}
