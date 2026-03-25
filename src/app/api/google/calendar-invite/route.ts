import { NextRequest, NextResponse } from "next/server";
import {
    assertBookingWriteAccessForUser,
    BookingWriteAccessDeniedError,
} from "@/lib/booking-write-access.server";
import { createClient } from "@/utils/supabase/server";
import { syncBookingCalendarEvent } from "@/lib/google-calendar-booking";
import { resolveBookingFreelancerNames } from "@/lib/booking-freelancers";
import { hasOAuthTokenPair } from "@/utils/google/connection";
import { fetchGoogleCalendarProfileSchemaSafe } from "@/app/api/google/_lib/calendar-profile";
import { resolveBookingFreelancerAttendeeEmails } from "@/lib/google-calendar-attendees";
import {
    getGoogleCalendarSyncErrorMessage,
    isNoScheduleSyncError,
    updateBookingCalendarSyncState,
} from "@/lib/google-calendar-sync";

export async function POST(req: NextRequest) {
    try {
        const payload = (await req.json()) as {
            bookingId?: string;
            attendeeEmails?: unknown;
        };
        const bookingId = typeof payload.bookingId === "string" ? payload.bookingId : "";

        if (!bookingId) {
            return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await assertBookingWriteAccessForUser(user.id, { locale: "en" });

        const profileResult = await fetchGoogleCalendarProfileSchemaSafe(supabase, user.id);
        if (profileResult.error) {
            await updateBookingCalendarSyncState({
                supabase,
                bookingId,
                userId: user.id,
                status: "failed",
                errorMessage: "Gagal memuat profil Google Calendar. Silakan coba lagi.",
            });
            console.error("Google Calendar profile query failed:", profileResult.error);
            return NextResponse.json(
                { error: "Gagal memuat profil Google Calendar. Silakan coba lagi." },
                { status: 500 },
            );
        }
        if (profileResult.droppedColumns.length > 0) {
            console.warn("Google Calendar profile columns missing:", profileResult.droppedColumns.join(", "));
        }

        const profile = profileResult.data;
        const accessToken = typeof profile?.google_access_token === "string"
            ? profile.google_access_token.trim()
            : "";
        const refreshToken = typeof profile?.google_refresh_token === "string"
            ? profile.google_refresh_token.trim()
            : "";

        if (!hasOAuthTokenPair(accessToken, refreshToken)) {
            await updateBookingCalendarSyncState({
                supabase,
                bookingId,
                userId: user.id,
                status: "failed",
                errorMessage: "Koneksi Google Calendar belum lengkap. Silakan hubungkan ulang di Pengaturan.",
            });
            return NextResponse.json(
                { error: "Koneksi Google Calendar belum lengkap. Silakan hubungkan ulang di Pengaturan." },
                { status: 400 },
            );
        }

        // Get booking details including service duration
        const { data: booking } = await supabase
            .from("bookings")
            .select("id, booking_code, client_name, client_whatsapp, session_date, location, location_lat, location_lng, location_detail, notes, event_type, extra_fields, google_calendar_event_id, google_calendar_event_ids, services(id, name, duration_minutes, is_addon, affects_schedule), booking_services(id, kind, sort_order, service:services(id, name, duration_minutes, is_addon, affects_schedule)), freelance(name), booking_freelance(freelance(name))")
            .eq("id", bookingId)
            .eq("user_id", user.id)
            .single();

        if (!booking) {
            return NextResponse.json({ error: "Booking not found" }, { status: 404 });
        }

        let attendeeEmails: string[] = [];
        try {
            const attendeeMap = await resolveBookingFreelancerAttendeeEmails({
                supabase,
                userId: user.id,
                bookingIds: [booking.id],
            });
            attendeeEmails = attendeeMap[booking.id] || [];
        } catch (error) {
            const message = getGoogleCalendarSyncErrorMessage(
                error,
                "Gagal memuat assignment freelancer untuk sinkronisasi kalender.",
            );
            await updateBookingCalendarSyncState({
                supabase,
                bookingId: booking.id,
                userId: user.id,
                status: "failed",
                errorMessage: message,
            });
            return NextResponse.json({ error: message }, { status: 500 });
        }

        try {
            const syncedEvent = await syncBookingCalendarEvent({
                profile: {
                    accessToken,
                    refreshToken,
                    studioName: profile?.studio_name ?? null,
                    eventFormat: profile?.calendar_event_format ?? null,
                    eventFormatMap: profile?.calendar_event_format_map ?? null,
                    eventDescription: profile?.calendar_event_description ?? null,
                    eventDescriptionMap: profile?.calendar_event_description_map ?? null,
                },
                booking: {
                    id: booking.id,
                    bookingCode: booking.booking_code,
                    clientName: booking.client_name,
                    clientWhatsapp: booking.client_whatsapp,
                    sessionDate: booking.session_date,
                    location: booking.location,
                    locationLat: booking.location_lat,
                    locationLng: booking.location_lng,
                    locationDetail: booking.location_detail,
                    eventType: booking.event_type,
                    notes: booking.notes,
                    extraFields: (booking as any).extra_fields,
                    freelancerNames: resolveBookingFreelancerNames({
                        bookingFreelance: (booking as { booking_freelance?: unknown }).booking_freelance,
                        legacyFreelance: (booking as { freelance?: unknown }).freelance,
                    }),
                    googleCalendarEventId: (booking as any).google_calendar_event_id,
                    googleCalendarEventIds: (booking as any).google_calendar_event_ids,
                    services: booking.services,
                    bookingServices: (booking as any).booking_services,
                },
                attendeeEmails,
            });

            const updated = await updateBookingCalendarSyncState({
                supabase,
                bookingId: booking.id,
                userId: user.id,
                status: "success",
                eventId: syncedEvent.eventId,
                eventIds: syncedEvent.eventIds,
            });
            if (!updated.ok) {
                console.warn(
                    "Failed to update booking calendar sync status (success):",
                    updated.error,
                );
            }

            return NextResponse.json({
                success: true,
                eventId: syncedEvent.eventId,
            });
        } catch (error) {
            const message = getGoogleCalendarSyncErrorMessage(error, "Failed to send calendar invite");
            const syncStatus = isNoScheduleSyncError(error) ? "skipped" : "failed";
            const updated = await updateBookingCalendarSyncState({
                supabase,
                bookingId: booking.id,
                userId: user.id,
                status: syncStatus,
                errorMessage: message,
            });
            if (!updated.ok) {
                console.warn(
                    `Failed to update booking calendar sync status (${syncStatus}):`,
                    updated.error,
                );
            }

            return NextResponse.json(
                { error: message },
                { status: syncStatus === "skipped" ? 400 : 500 },
            );
        }
    } catch (error: any) {
        if (error instanceof BookingWriteAccessDeniedError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("Calendar invite error:", error);
        return NextResponse.json({ error: error.message || "Failed to send calendar invite" }, { status: 500 });
    }
}
