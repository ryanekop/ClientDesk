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
import { resolveBookingFreelancerAttendeeEmailsWithSessions } from "@/lib/google-calendar-attendees";
import {
    GOOGLE_INVALID_GRANT_CODE,
    GOOGLE_SCOPE_MISMATCH_CODE,
    getGoogleCalendarSyncErrorCode,
    getGoogleCalendarSyncErrorMessage,
    isNoScheduleSyncError,
    updateBookingCalendarSyncState,
} from "@/lib/google-calendar-sync";
import { apiText } from "@/lib/i18n/api-errors";
import { resolveApiLocale } from "@/lib/i18n/api-locale";
import { clearGoogleCalendarConnection } from "@/lib/google-calendar-reauth";
import { resolvePublicOrigin } from "@/lib/auth/public-origin";
import { buildBookingDetailLink } from "@/lib/booking-detail-link";
import { buildGoogleInvalidGrantPayload } from "@/lib/google-oauth-error";

export async function POST(req: NextRequest) {
    try {
        const locale = resolveApiLocale(req);
        const publicOrigin = resolvePublicOrigin(req);
        const payload = (await req.json()) as {
            bookingId?: string;
            attendeeEmails?: unknown;
        };
        const bookingId = typeof payload.bookingId === "string" ? payload.bookingId : "";

        if (!bookingId) {
            return NextResponse.json(
                { error: apiText(req, "bookingIdRequired") },
                { status: 400 },
            );
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json(
                { error: apiText(req, "unauthorized") },
                { status: 401 },
            );
        }

        await assertBookingWriteAccessForUser(user.id, { locale });

        const profileResult = await fetchGoogleCalendarProfileSchemaSafe(supabase, user.id);
        if (profileResult.error) {
            const profileErrorMessage = apiText(req, "failedLoadCalendarProfile");
            await updateBookingCalendarSyncState({
                supabase,
                bookingId,
                userId: user.id,
                status: "failed",
                errorMessage: profileErrorMessage,
            });
            console.error("Google Calendar profile query failed:", profileResult.error);
            return NextResponse.json(
                { error: profileErrorMessage },
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
            await clearGoogleCalendarConnection(supabase, user.id);
            const tokenErrorMessage = apiText(req, "incompleteCalendarConnection");
            await updateBookingCalendarSyncState({
                supabase,
                bookingId,
                userId: user.id,
                status: "failed",
                errorMessage: tokenErrorMessage,
            });
            return NextResponse.json(
                { error: tokenErrorMessage },
                { status: 400 },
            );
        }

        // Get booking details including service duration
        const { data: booking } = await supabase
            .from("bookings")
            .select("id, booking_code, client_name, client_whatsapp, instagram, session_date, location, location_lat, location_lng, location_detail, notes, event_type, extra_fields, google_calendar_event_id, google_calendar_event_ids, services(id, name, duration_minutes, is_addon, affects_schedule), booking_services(id, kind, sort_order, quantity, service:services(id, name, duration_minutes, is_addon, affects_schedule)), freelance(name), booking_freelance(freelance(name))")
            .eq("id", bookingId)
            .eq("user_id", user.id)
            .single();

        if (!booking) {
            return NextResponse.json(
                { error: apiText(req, "bookingNotFound") },
                { status: 404 },
            );
        }

        let attendeeEmails: string[] = [];
        let attendeeEmailsBySession: Record<string, string[]> = {};
        try {
            const attendeeResolution = await resolveBookingFreelancerAttendeeEmailsWithSessions({
                supabase,
                userId: user.id,
                bookingIds: [booking.id],
            });
            attendeeEmails = attendeeResolution.attendeeEmailsByBooking[booking.id] || [];
            attendeeEmailsBySession =
                attendeeResolution.attendeeEmailsByBookingSession[booking.id] || {};
        } catch (error) {
            const message = getGoogleCalendarSyncErrorMessage(
                error,
                apiText(req, "failedLoadFreelanceAssignments"),
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
            const bookingRecord = booking as {
                extra_fields?: Record<string, unknown> | null;
                google_calendar_event_id?: string | null;
                google_calendar_event_ids?: unknown;
                booking_services?: unknown;
            };
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
                    bookingDetailLink: buildBookingDetailLink({
                        publicOrigin,
                        locale,
                        bookingId: booking.id,
                    }),
                    clientName: booking.client_name,
                    clientWhatsapp: booking.client_whatsapp,
                    instagram: booking.instagram,
                    sessionDate: booking.session_date,
                    location: booking.location,
                    locationLat: booking.location_lat,
                    locationLng: booking.location_lng,
                    locationDetail: booking.location_detail,
                    eventType: booking.event_type,
                    notes: booking.notes,
                    extraFields: bookingRecord.extra_fields ?? null,
                    freelancerNames: resolveBookingFreelancerNames({
                        bookingFreelance: (booking as { booking_freelance?: unknown }).booking_freelance,
                        legacyFreelance: (booking as { freelance?: unknown }).freelance,
                    }),
                    googleCalendarEventId: bookingRecord.google_calendar_event_id ?? null,
                    googleCalendarEventIds: bookingRecord.google_calendar_event_ids,
                    services: booking.services,
                    bookingServices: bookingRecord.booking_services,
                },
                attendeeEmails,
                attendeeEmailsBySession,
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
            const errorCode = getGoogleCalendarSyncErrorCode(error);
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

            if (errorCode === GOOGLE_SCOPE_MISMATCH_CODE) {
                await clearGoogleCalendarConnection(supabase, user.id);
                return NextResponse.json(
                    {
                        error: message,
                        code: GOOGLE_SCOPE_MISMATCH_CODE,
                        reconnectRequired: true,
                    },
                    { status: 403 },
                );
            }

            if (errorCode === GOOGLE_INVALID_GRANT_CODE) {
                await clearGoogleCalendarConnection(supabase, user.id);
                return NextResponse.json(
                    buildGoogleInvalidGrantPayload("calendar", message),
                    { status: 403 },
                );
            }

            return NextResponse.json(
                { error: message },
                { status: syncStatus === "skipped" ? 400 : 500 },
            );
        }
    } catch (error) {
        if (error instanceof BookingWriteAccessDeniedError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("Calendar invite error:", error);
        const message = error instanceof Error ? error.message : apiText(req, "failedSendCalendarInvite");
        return NextResponse.json(
            { error: message },
            { status: 500 },
        );
    }
}
