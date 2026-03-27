import { NextRequest, NextResponse } from "next/server";
import {
    assertBookingWriteAccessForUser,
    BookingWriteAccessDeniedError,
} from "@/lib/booking-write-access.server";
import { createClient } from "@/utils/supabase/server";
import { hasOAuthTokenPair } from "@/utils/google/connection";
import { fetchGoogleCalendarProfileSchemaSafe } from "@/app/api/google/_lib/calendar-profile";
import { resolveBookingFreelancerAttendeeEmails } from "@/lib/google-calendar-attendees";
import {
    getGoogleCalendarSyncErrorMessage,
    updateBookingCalendarSyncState,
} from "@/lib/google-calendar-sync";
import {
    fetchGoogleCalendarSyncBookings,
    syncSingleBookingCalendar,
} from "@/lib/google-calendar-sync-booking";
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

        const bookingRows = await fetchGoogleCalendarSyncBookings({
            supabase,
            userId: user.id,
            bookingIds,
        });

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
            const result = await syncSingleBookingCalendar({
                supabase,
                userId: user.id,
                booking,
                profile: {
                    accessToken,
                    refreshToken,
                    studioName: profile?.studio_name ?? null,
                    eventFormat: profile?.calendar_event_format ?? null,
                    eventFormatMap: profile?.calendar_event_format_map ?? null,
                    eventDescription: profile?.calendar_event_description ?? null,
                    eventDescriptionMap: profile?.calendar_event_description_map ?? null,
                },
                attendeeEmails: attendeeEmailsByBooking[booking.id] || [],
                fallbackErrorMessage: "Unknown error",
            });

            if (result.status === "success") {
                successCount++;
                continue;
            }

            if (result.status === "skipped") {
                skippedCount++;
                skipped.push(`${result.bookingCode}: ${result.errorMessage || "Skipped"}`);
                continue;
            }

            failedCount++;
            errors.push(`${result.bookingCode}: ${result.errorMessage || "Unknown error"}`);
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
