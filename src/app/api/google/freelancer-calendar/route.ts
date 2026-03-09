import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getCalendarClient } from "@/utils/google/calendar";

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ success: false, error: "Tidak terautentikasi" }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("google_access_token, google_refresh_token")
            .eq("id", user.id)
            .single();

        if (!profile?.google_access_token || !profile?.google_refresh_token) {
            return NextResponse.json({ success: false, error: "Google Calendar belum terhubung." }, { status: 400 });
        }

        const url = new URL(request.url);
        const calendarEmail = url.searchParams.get("email");
        if (!calendarEmail) {
            return NextResponse.json({ success: false, error: "Email parameter required." }, { status: 400 });
        }

        const timeMin = url.searchParams.get("timeMin") || new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString();
        const timeMax = url.searchParams.get("timeMax") || new Date(new Date().getFullYear(), new Date().getMonth() + 2, 0).toISOString();

        const calendar = await getCalendarClient(profile.google_access_token, profile.google_refresh_token);

        const res = await calendar.events.list({
            calendarId: calendarEmail,
            timeMin,
            timeMax,
            singleEvents: true,
            orderBy: "startTime",
            maxResults: 250,
        });

        const events = (res.data.items || []).map((event) => ({
            id: event.id,
            title: event.summary || "(Tanpa Judul)",
            start: event.start?.dateTime || event.start?.date || "",
            end: event.end?.dateTime || event.end?.date || "",
            description: event.description || "",
            isAllDay: !event.start?.dateTime,
            source: "freelancer",
        }));

        return NextResponse.json({ success: true, events });
    } catch (err: any) {
        // Common error: 404 if calendar not shared
        if (err.code === 404 || err.response?.status === 404) {
            return NextResponse.json({ success: false, error: "Kalender freelancer tidak ditemukan. Pastikan freelancer sudah share kalendernya ke email Anda." }, { status: 404 });
        }
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
