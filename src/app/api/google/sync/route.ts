import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { syncBookingCalendarEvent } from "@/lib/google-calendar-booking";

type SyncRequestBody = {
    bookingIds?: string[];
    events?: Array<{ bookingId?: string }>;
};

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
            .select("google_access_token, google_refresh_token, studio_name, calendar_event_format, calendar_event_format_map, calendar_event_description, calendar_event_description_map")
            .eq("id", user.id)
            .single();

        if (!profile?.google_access_token || !profile?.google_refresh_token) {
            return NextResponse.json({ success: false, error: "Google Calendar belum terhubung. Silakan hubungkan dulu." }, { status: 400 });
        }

        const payload = await request.json() as SyncRequestBody;
        const bookingIdsFromPayload = Array.isArray(payload.bookingIds)
            ? payload.bookingIds.filter((value): value is string => typeof value === "string" && value.length > 0)
            : [];
        const bookingIdsFromEvents = Array.isArray(payload.events)
            ? payload.events
                .map((event) => event?.bookingId)
                .filter((value): value is string => typeof value === "string" && value.length > 0)
            : [];
        const bookingIds = Array.from(new Set([...bookingIdsFromPayload, ...bookingIdsFromEvents]));

        if (bookingIds.length === 0) {
            return NextResponse.json({ success: false, error: "Tidak ada event untuk disinkronkan." }, { status: 400 });
        }

        const { data: bookings } = await supabase
            .from("bookings")
            .select("id, booking_code, client_name, client_whatsapp, session_date, location, location_detail, notes, event_type, extra_fields, google_calendar_event_id, google_calendar_event_ids, services(id, name, duration_minutes, is_addon), booking_services(id, kind, sort_order, service:services(id, name, duration_minutes, is_addon))")
            .eq("user_id", user.id)
            .in("id", bookingIds);

        let successCount = 0;
        const errors: string[] = [];

        for (const booking of bookings || []) {
            try {
                const syncedEvent = await syncBookingCalendarEvent({
                    profile: {
                        accessToken: profile.google_access_token,
                        refreshToken: profile.google_refresh_token,
                        studioName: profile.studio_name,
                        eventFormat: profile.calendar_event_format,
                        eventFormatMap: profile.calendar_event_format_map,
                        eventDescription: profile.calendar_event_description,
                        eventDescriptionMap: profile.calendar_event_description_map,
                    },
                    booking: {
                        id: booking.id,
                        bookingCode: booking.booking_code,
                        clientName: booking.client_name,
                        clientWhatsapp: booking.client_whatsapp,
                        sessionDate: booking.session_date,
                        location: booking.location,
                        locationDetail: booking.location_detail,
                        eventType: booking.event_type,
                        notes: booking.notes,
                        extraFields: booking.extra_fields,
                        googleCalendarEventId: booking.google_calendar_event_id,
                        googleCalendarEventIds: (booking as any).google_calendar_event_ids,
                        services: booking.services,
                        bookingServices: booking.booking_services,
                    },
                });

                await supabase
                    .from("bookings")
                    .update({
                        google_calendar_event_id: syncedEvent.eventId,
                        google_calendar_event_ids: syncedEvent.eventIds,
                    })
                    .eq("id", booking.id)
                    .eq("user_id", user.id);
                successCount++;
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                errors.push(`${booking.booking_code}: ${message}`);
            }
        }

        return NextResponse.json({
            success: true,
            count: successCount,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
