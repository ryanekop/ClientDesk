import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { pushEventToCalendar } from "@/utils/google/calendar";
import { getSessionDateUTC } from "@/utils/format-date";

export async function POST(req: NextRequest) {
    try {
        const { bookingId, attendeeEmails } = await req.json();

        if (!bookingId || !attendeeEmails || attendeeEmails.length === 0) {
            return NextResponse.json({ error: "Missing bookingId or attendeeEmails" }, { status: 400 });
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // Get vendor's Google Calendar tokens + event name format
        const { data: profile } = await supabase
            .from("profiles")
            .select("google_access_token, google_refresh_token, studio_name, calendar_event_format")
            .eq("id", user.id)
            .single();

        if (!profile?.google_access_token || !profile?.google_refresh_token) {
            return NextResponse.json({ error: "Google Calendar not connected" }, { status: 400 });
        }

        // Get booking details including service duration
        const { data: booking } = await supabase
            .from("bookings")
            .select("booking_code, client_name, session_date, location, event_type, services(name, duration_minutes)")
            .eq("id", bookingId)
            .eq("user_id", user.id)
            .single();

        if (!booking || !booking.session_date) {
            return NextResponse.json({ error: "Booking not found or no session date" }, { status: 404 });
        }

        const serviceName = (booking.services as any)?.name || booking.event_type || "Sesi Foto";
        const durationMinutes = (booking.services as any)?.duration_minutes || 120; // fallback 2 hours

        const start = getSessionDateUTC(booking.session_date);
        const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

        // Build custom event name from format template
        const eventFormat = (profile as any).calendar_event_format || "📸 {{client_name}} — {{service_name}}";
        const vars: Record<string, string> = {
            client_name: booking.client_name,
            service_name: serviceName,
            event_type: booking.event_type || "-",
            booking_code: (booking as any).booking_code || "",
            studio_name: profile.studio_name || "Client Desk",
        };
        const summary = eventFormat.replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => vars[key] || `{{${key}}}`);

        await pushEventToCalendar(
            profile.google_access_token,
            profile.google_refresh_token,
            {
                summary,
                description: `Klien: ${booking.client_name}\nLokasi: ${booking.location || "-"}\nTipe: ${booking.event_type || "-"}\n\nDikirim oleh ${profile.studio_name || "Client Desk"}`,
                start,
                end,
                attendees: attendeeEmails,
            }
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Calendar invite error:", error);
        return NextResponse.json({ error: error.message || "Failed to send calendar invite" }, { status: 500 });
    }
}
