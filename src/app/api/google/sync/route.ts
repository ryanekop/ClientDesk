import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { pushEventToCalendar } from "@/utils/google/calendar";
import {
    buildCalendarRangeFromInstants,
    buildCalendarRangeFromLocalInput,
} from "@/utils/google/template";

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ success: false, error: "Tidak terautentikasi" }, { status: 401 });
        }

        // Get stored Google tokens
        const { data: profile } = await supabase
            .from("profiles")
            .select("google_access_token, google_refresh_token")
            .eq("id", user.id)
            .single();

        if (!profile?.google_access_token || !profile?.google_refresh_token) {
            return NextResponse.json({ success: false, error: "Google Calendar belum terhubung. Silakan hubungkan dulu." }, { status: 400 });
        }

        const { events } = await request.json();

        if (!events || events.length === 0) {
            return NextResponse.json({ success: false, error: "Tidak ada event untuk disinkronkan." }, { status: 400 });
        }

        let successCount = 0;
        const errors: string[] = [];

        for (const event of events) {
            try {
                const range = typeof event.startLocal === "string" && typeof event.endLocal === "string"
                    ? {
                        start: buildCalendarRangeFromLocalInput(event.startLocal, 0).start,
                        end: buildCalendarRangeFromLocalInput(event.endLocal, 0).start,
                    }
                    : buildCalendarRangeFromInstants(new Date(event.start), new Date(event.end));

                await pushEventToCalendar(
                    profile.google_access_token,
                    profile.google_refresh_token,
                    {
                        summary: event.summary,
                        description: event.description,
                        start: range.start,
                        end: range.end,
                    }
                );
                successCount++;
            } catch (err: any) {
                errors.push(`${event.summary}: ${err.message}`);
            }
        }

        return NextResponse.json({
            success: true,
            count: successCount,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
