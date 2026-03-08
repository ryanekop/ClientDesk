import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { pushEventToCalendar } from "@/utils/google/calendar";

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
                await pushEventToCalendar(
                    profile.google_access_token,
                    profile.google_refresh_token,
                    {
                        summary: event.summary,
                        description: event.description,
                        start: new Date(event.start),
                        end: new Date(event.end),
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
