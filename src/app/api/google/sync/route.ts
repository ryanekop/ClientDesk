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
import { apiText } from "@/lib/i18n/api-errors";
import { resolveApiLocale } from "@/lib/i18n/api-locale";

type SyncRequestBody = {
    bookingIds?: string[];
    events?: Array<{ bookingId?: string }>;
};

export async function POST(request: NextRequest) {
    try {
        const locale = resolveApiLocale(request);
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { success: false, error: apiText(request, "unauthorized") },
                { status: 401 },
            );
        }

        await assertBookingWriteAccessForUser(user.id, { locale });

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
            return NextResponse.json(
                { success: false, error: apiText(request, "noEventsToSync") },
                { status: 400 },
            );
        }

        const profileResult = await fetchGoogleCalendarProfileSchemaSafe(supabase, user.id);
        if (profileResult.error) {
            const profileErrorMessage = apiText(request, "failedLoadCalendarProfile");
            for (const bookingId of bookingIds) {
                await updateBookingCalendarSyncState({
                    supabase,
                    bookingId,
                    userId: user.id,
                    status: "failed",
                    errorMessage: profileErrorMessage,
                });
            }
            console.error("Google Calendar profile query failed:", profileResult.error);
            return NextResponse.json(
                { success: false, error: profileErrorMessage },
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
            const tokenErrorMessage = apiText(request, "incompleteCalendarConnection");
            for (const bookingId of bookingIds) {
                await updateBookingCalendarSyncState({
                    supabase,
                    bookingId,
                    userId: user.id,
                    status: "failed",
                    errorMessage: tokenErrorMessage,
                });
            }
            return NextResponse.json({ success: false, error: tokenErrorMessage }, { status: 400 });
        }

        const { data: bookings } = await supabase
            .from("bookings")
            .select("id, booking_code, client_name, client_whatsapp, session_date, location, location_lat, location_lng, location_detail, notes, event_type, extra_fields, google_calendar_event_id, google_calendar_event_ids, services(id, name, duration_minutes, is_addon, affects_schedule), booking_services(id, kind, sort_order, service:services(id, name, duration_minutes, is_addon, affects_schedule)), freelance(name), booking_freelance(freelance(name))")
            .eq("user_id", user.id)
            .in("id", bookingIds);
        const bookingRows = bookings || [];

        let attendeeEmailsByBooking: Record<string, string[]> = {};
        try {
            attendeeEmailsByBooking = await resolveBookingFreelancerAttendeeEmails({
                supabase,
                userId: user.id,
                bookingIds: bookingRows.map((booking) => booking.id),
            });
        } catch (error) {
            const attendeeErrorMessage = getGoogleCalendarSyncErrorMessage(
                error,
                apiText(request, "failedLoadFreelanceAssignments"),
            );
            for (const bookingId of bookingIds) {
                await updateBookingCalendarSyncState({
                    supabase,
                    bookingId,
                    userId: user.id,
                    status: "failed",
                    errorMessage: attendeeErrorMessage,
                });
            }
            return NextResponse.json(
                { success: false, error: attendeeErrorMessage },
                { status: 500 },
            );
        }

        let successCount = 0;
        let failedCount = 0;
        let skippedCount = 0;
        const errors: string[] = [];
        const skipped: string[] = [];

        for (const booking of bookingRows) {
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
                        extraFields: booking.extra_fields,
                        freelancerNames: resolveBookingFreelancerNames({
                            bookingFreelance: (booking as { booking_freelance?: unknown }).booking_freelance,
                            legacyFreelance: (booking as { freelance?: unknown }).freelance,
                        }),
                        googleCalendarEventId: booking.google_calendar_event_id,
                        googleCalendarEventIds:
                            (booking as { google_calendar_event_ids?: unknown })
                                .google_calendar_event_ids,
                        services: booking.services,
                        bookingServices: booking.booking_services,
                    },
                    attendeeEmails: attendeeEmailsByBooking[booking.id] || [],
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
                successCount++;
            } catch (error) {
                const message = getGoogleCalendarSyncErrorMessage(error, "Unknown error");

                if (isNoScheduleSyncError(error)) {
                    skippedCount++;
                    skipped.push(`${booking.booking_code}: ${message}`);
                    const updated = await updateBookingCalendarSyncState({
                        supabase,
                        bookingId: booking.id,
                        userId: user.id,
                        status: "skipped",
                        errorMessage: message,
                    });
                    if (!updated.ok) {
                        console.warn(
                            "Failed to update booking calendar sync status (skipped):",
                            updated.error,
                        );
                    }
                    continue;
                }

                failedCount++;
                errors.push(`${booking.booking_code}: ${message}`);
                const updated = await updateBookingCalendarSyncState({
                    supabase,
                    bookingId: booking.id,
                    userId: user.id,
                    status: "failed",
                    errorMessage: message,
                });
                if (!updated.ok) {
                    console.warn(
                        "Failed to update booking calendar sync status (failed):",
                        updated.error,
                    );
                }
            }
        }

        return NextResponse.json({
            success: successCount > 0,
            count: successCount,
            successCount,
            failedCount,
            skippedCount,
            errors: errors.length > 0 ? errors : undefined,
            skipped: skipped.length > 0 ? skipped : undefined,
        });
    } catch (error) {
        if (error instanceof BookingWriteAccessDeniedError) {
            return NextResponse.json(
                { success: false, error: error.message },
                { status: error.status },
            );
        }
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
