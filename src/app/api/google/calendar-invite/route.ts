import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { syncBookingCalendarEvent } from "@/lib/google-calendar-booking";

export async function POST(req: NextRequest) {
    try {
        const { bookingId, attendeeEmails } = await req.json();

        if (!bookingId) {
            return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // Get vendor's Google Calendar tokens + event name format
        const { data: profile } = await supabase
            .from("profiles")
            .select("google_access_token, google_refresh_token, studio_name, calendar_event_format, calendar_event_format_map, calendar_event_description, calendar_event_description_map")
            .eq("id", user.id)
            .single();

        if (!profile?.google_access_token || !profile?.google_refresh_token) {
            return NextResponse.json({ error: "Google Calendar not connected" }, { status: 400 });
        }

        // Get booking details including service duration
        const { data: booking } = await supabase
            .from("bookings")
            .select("id, booking_code, client_name, session_date, location, event_type, extra_fields, google_calendar_event_id, services(id, name, duration_minutes, is_addon), booking_services(id, kind, sort_order, service:services(id, name, duration_minutes, is_addon))")
            .eq("id", bookingId)
            .eq("user_id", user.id)
            .single();

        if (!booking || !booking.session_date) {
            return NextResponse.json({ error: "Booking not found or no session date" }, { status: 404 });
        }

        const syncedEvent = await syncBookingCalendarEvent({
            profile: {
                accessToken: profile.google_access_token,
                refreshToken: profile.google_refresh_token,
                studioName: profile.studio_name,
                eventFormat: (profile as any).calendar_event_format,
                eventFormatMap: (profile as any).calendar_event_format_map,
                eventDescription: (profile as any).calendar_event_description,
                eventDescriptionMap: (profile as any).calendar_event_description_map,
            },
            booking: {
                id: booking.id,
                bookingCode: booking.booking_code,
                clientName: booking.client_name,
                sessionDate: booking.session_date,
                location: booking.location,
                eventType: booking.event_type,
                extraFields: (booking as any).extra_fields,
                googleCalendarEventId: (booking as any).google_calendar_event_id,
                services: booking.services,
                bookingServices: (booking as any).booking_services,
            },
            attendeeEmails: Array.isArray(attendeeEmails) ? attendeeEmails : [],
        });

        await supabase
            .from("bookings")
            .update({ google_calendar_event_id: syncedEvent.eventId })
            .eq("id", booking.id)
            .eq("user_id", user.id);

        return NextResponse.json({
            success: true,
            eventId: syncedEvent.eventId,
        });
    } catch (error: any) {
        console.error("Calendar invite error:", error);
        return NextResponse.json({ error: error.message || "Failed to send calendar invite" }, { status: 500 });
    }
}
