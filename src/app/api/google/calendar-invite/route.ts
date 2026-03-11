import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { pushEventToCalendar } from "@/utils/google/calendar";

export async function POST(req: NextRequest) {
    try {
        const { bookingId, attendeeEmails } = await req.json();

        if (!bookingId || !attendeeEmails || attendeeEmails.length === 0) {
            return NextResponse.json({ error: "Missing bookingId or attendeeEmails" }, { status: 400 });
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // Get vendor's Google Calendar tokens
        const { data: profile } = await supabase
            .from("profiles")
            .select("google_access_token, google_refresh_token, studio_name")
            .eq("id", user.id)
            .single();

        if (!profile?.google_access_token || !profile?.google_refresh_token) {
            return NextResponse.json({ error: "Google Calendar not connected" }, { status: 400 });
        }

        // Get booking details
        const { data: booking } = await supabase
            .from("bookings")
            .select("client_name, session_date, location, event_type, services(name)")
            .eq("id", bookingId)
            .eq("user_id", user.id)
            .single();

        if (!booking || !booking.session_date) {
            return NextResponse.json({ error: "Booking not found or no session date" }, { status: 404 });
        }

        const start = new Date(booking.session_date);
        const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // default 2 hours
        const serviceName = (booking.services as any)?.name || booking.event_type || "Sesi Foto";

        await pushEventToCalendar(
            profile.google_access_token,
            profile.google_refresh_token,
            {
                summary: `📸 ${booking.client_name} — ${serviceName}`,
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
