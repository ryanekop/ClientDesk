import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getCalendarClient } from "@/utils/google/calendar";
import { apiText } from "@/lib/i18n/api-errors";
import { clearGoogleCalendarConnection } from "@/lib/google-calendar-reauth";
import {
    buildGoogleInvalidGrantPayload,
    isGoogleInvalidGrantError,
} from "@/lib/google-oauth-error";

export async function GET(request: NextRequest) {
    let userId: string | null = null;
    let supabase: Awaited<ReturnType<typeof createClient>> | null = null;
    try {
        supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { success: false, error: apiText(request, "unauthorized") },
                { status: 401 },
            );
        }
        userId = user.id;

        const { data: profile } = await supabase
            .from("profiles")
            .select("google_access_token, google_refresh_token")
            .eq("id", user.id)
            .single();

        if (!profile?.google_access_token || !profile?.google_refresh_token) {
            return NextResponse.json(
                { success: false, error: apiText(request, "calendarNotConnected") },
                { status: 400 },
            );
        }

        const url = new URL(request.url);
        const timeMin = url.searchParams.get("timeMin") || new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString();
        const timeMax = url.searchParams.get("timeMax") || new Date(new Date().getFullYear(), new Date().getMonth() + 2, 0).toISOString();

        const calendar = await getCalendarClient(profile.google_access_token, profile.google_refresh_token);

        const res = await calendar.events.list({
            calendarId: "primary",
            timeMin,
            timeMax,
            singleEvents: true,
            orderBy: "startTime",
            maxResults: 250,
        });

        const events = (res.data.items || []).map((event) => ({
            id: event.id,
            title: event.summary || apiText(request, "untitled"),
            start: event.start?.dateTime || event.start?.date || "",
            end: event.end?.dateTime || event.end?.date || "",
            description: event.description || "",
            isAllDay: !event.start?.dateTime,
            source: "google",
        }));

        return NextResponse.json({ success: true, events });
    } catch (error) {
        if (userId && supabase && isGoogleInvalidGrantError(error)) {
            await clearGoogleCalendarConnection(supabase, userId);
            return NextResponse.json(
                { success: false, ...buildGoogleInvalidGrantPayload("calendar") },
                { status: 403 },
            );
        }
        const message = error instanceof Error ? error.message : apiText(request, "failedLoadCalendarProfile");
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
