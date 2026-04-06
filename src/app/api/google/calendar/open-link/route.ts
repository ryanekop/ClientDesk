import { NextRequest, NextResponse } from "next/server";
import {
  assertBookingWriteAccessForUser,
  BookingWriteAccessDeniedError,
} from "@/lib/booking-write-access.server";
import {
  GOOGLE_CALENDAR_PROFILE_COLUMNS,
  fetchGoogleCalendarProfileSchemaSafe,
} from "@/app/api/google/_lib/calendar-profile";
import { createClient } from "@/utils/supabase/server";
import { hasOAuthTokenPair } from "@/utils/google/connection";
import { getCalendarClient } from "@/utils/google/calendar";
import { resolveBookingFreelancerAttendeeEmailsWithSessions } from "@/lib/google-calendar-attendees";
import { normalizeGoogleCalendarEventIds } from "@/lib/booking-calendar-sessions";
import {
  GOOGLE_INVALID_GRANT_CODE,
  getGoogleCalendarSyncErrorMessage,
  updateBookingCalendarSyncState,
} from "@/lib/google-calendar-sync";
import {
  fetchGoogleCalendarSyncBookingById,
  syncSingleBookingCalendar,
} from "@/lib/google-calendar-sync-booking";
import { apiText } from "@/lib/i18n/api-errors";
import { resolveApiLocale } from "@/lib/i18n/api-locale";
import { resolvePublicOrigin } from "@/lib/auth/public-origin";
import { clearGoogleCalendarConnection } from "@/lib/google-calendar-reauth";
import {
  buildGoogleInvalidGrantPayload,
  isGoogleInvalidGrantError,
} from "@/lib/google-oauth-error";

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function resolveSessionEventId(eventIds: Record<string, string>, sessionKey?: string | null) {
  if (sessionKey && eventIds[sessionKey]) return eventIds[sessionKey];
  if (eventIds.primary) return eventIds.primary;
  const fallback = Object.values(eventIds).find(
    (value) => typeof value === "string" && value.trim(),
  );
  return fallback || null;
}

function extractGoogleStatus(error: unknown) {
  if (typeof error === "object" && error !== null) {
    const withCode = error as { code?: unknown };
    if (typeof withCode.code === "number") return withCode.code;

    const withResponse = error as {
      response?: {
        status?: unknown;
      };
    };
    if (typeof withResponse.response?.status === "number") {
      return withResponse.response.status;
    }
  }

  return null;
}

function isGoogleNotFound(error: unknown) {
  return extractGoogleStatus(error) === 404;
}

function encodeGoogleEventEditId(eventId: string, calendarId: string) {
  return Buffer.from(`${eventId} ${calendarId}`, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildGoogleEventEditUrl(eventId: string, calendarId: string) {
  return `https://calendar.google.com/calendar/u/0/r/eventedit/${encodeGoogleEventEditId(eventId, calendarId)}`;
}

function buildGoogleCalendarSearchUrl(bookingCode: string | null) {
  if (!bookingCode) {
    return "https://calendar.google.com/calendar/u/0/r";
  }

  return `https://calendar.google.com/calendar/u/0/r/search?q=${encodeURIComponent(bookingCode)}`;
}

async function resolveCanonicalEventUrl(args: {
  accessToken: string;
  refreshToken: string;
  eventId: string;
  calendarIdHint: string;
}) {
  try {
    const calendar = await getCalendarClient(args.accessToken, args.refreshToken);
    const { data } = await calendar.events.get({
      calendarId: "primary",
      eventId: args.eventId,
    });

    const htmlLink = normalizeOptionalString(data.htmlLink);
    if (htmlLink) {
      return {
        found: true,
        openUrl: htmlLink,
        errorMessage: null,
        invalidGrant: false,
      };
    }

    const eventCalendarId =
      normalizeOptionalString(data.organizer?.email) || args.calendarIdHint;

    return {
      found: true,
      openUrl: buildGoogleEventEditUrl(args.eventId, eventCalendarId),
      errorMessage: null,
      invalidGrant: false,
    };
  } catch (error) {
    if (isGoogleInvalidGrantError(error)) {
      return {
        found: false,
        openUrl: null,
        errorMessage: getGoogleCalendarSyncErrorMessage(error),
        invalidGrant: true,
      };
    }

    if (isGoogleNotFound(error)) {
      return {
        found: false,
        openUrl: null,
        errorMessage: null,
        invalidGrant: false,
      };
    }

    return {
      found: false,
      openUrl: null,
      errorMessage: getGoogleCalendarSyncErrorMessage(
        error,
        "Failed to validate Google Calendar event",
      ),
      invalidGrant: false,
    };
  }
}

export async function POST(request: NextRequest) {
  let userId: string | null = null;
  let supabase: Awaited<ReturnType<typeof createClient>> | null = null;
  try {
    const locale = resolveApiLocale(request);
    const publicOrigin = resolvePublicOrigin(request);
    supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: apiText(request, "unauthorized") },
        { status: 401 },
      );
    }
    userId = user.id;

    await assertBookingWriteAccessForUser(user.id, { locale });

    const payload = (await request.json().catch(() => null)) as
      | {
          bookingId?: unknown;
          sessionKey?: unknown;
        }
      | null;

    const bookingId = normalizeOptionalString(payload?.bookingId);
    const sessionKey = normalizeOptionalString(payload?.sessionKey);

    if (!bookingId) {
      return NextResponse.json(
        { success: false, error: apiText(request, "bookingIdRequired") },
        { status: 400 },
      );
    }

    const profileResult = await fetchGoogleCalendarProfileSchemaSafe(
      supabase,
      user.id,
      [...GOOGLE_CALENDAR_PROFILE_COLUMNS, "google_calendar_account_email"],
    );

    if (profileResult.error) {
      console.error("Google Calendar profile query failed:", profileResult.error);
      return NextResponse.json(
        { success: false, error: apiText(request, "failedLoadCalendarProfile") },
        { status: 500 },
      );
    }

    if (profileResult.droppedColumns.length > 0) {
      console.warn(
        "Google Calendar profile columns missing:",
        profileResult.droppedColumns.join(", "),
      );
    }

    const profile = profileResult.data as
      | {
          google_access_token?: string | null;
          google_refresh_token?: string | null;
          studio_name?: string | null;
          calendar_event_format?: string | null;
          calendar_event_format_map?: Record<string, string> | null;
          calendar_event_description?: string | null;
          calendar_event_description_map?: Record<string, string> | null;
          google_calendar_account_email?: string | null;
        }
      | null;

    const accessToken = normalizeOptionalString(profile?.google_access_token) || "";
    const refreshToken = normalizeOptionalString(profile?.google_refresh_token) || "";

    if (!hasOAuthTokenPair(accessToken, refreshToken)) {
      await clearGoogleCalendarConnection(supabase, user.id);
      return NextResponse.json(
        { success: false, error: apiText(request, "incompleteCalendarConnection") },
        { status: 400 },
      );
    }

    const calendarIdHint =
      normalizeOptionalString(profile?.google_calendar_account_email) || "primary";

    const booking = await fetchGoogleCalendarSyncBookingById({
      supabase,
      userId: user.id,
      bookingId,
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: apiText(request, "bookingNotFound") },
        { status: 404 },
      );
    }

    const bookingCode = normalizeOptionalString(booking.booking_code);
    const existingEventIds = normalizeGoogleCalendarEventIds(
      booking.google_calendar_event_ids,
      booking.google_calendar_event_id,
    );
    const existingEventId = resolveSessionEventId(existingEventIds, sessionKey);

    let lastErrorMessage: string | null = null;

    if (existingEventId) {
      const existingOpen = await resolveCanonicalEventUrl({
        accessToken,
        refreshToken,
        eventId: existingEventId,
        calendarIdHint,
      });

      if (existingOpen.openUrl) {
        return NextResponse.json({
          success: true,
          mode: "event",
          source: "existing",
          openUrl: existingOpen.openUrl,
          bookingCode,
        });
      }

      if (existingOpen.invalidGrant) {
        await clearGoogleCalendarConnection(supabase, user.id);
        return NextResponse.json(
          { success: false, ...buildGoogleInvalidGrantPayload("calendar") },
          { status: 403 },
        );
      }

      if (existingOpen.errorMessage) {
        lastErrorMessage = existingOpen.errorMessage;
      }
    }

    let attendeeEmails: string[] | null = null;
    let attendeeEmailsBySession: Record<string, string[]> | null = null;
    try {
      const attendeeResolution =
        await resolveBookingFreelancerAttendeeEmailsWithSessions({
        supabase,
        userId: user.id,
        bookingIds: [booking.id],
      });
      attendeeEmails = attendeeResolution.attendeeEmailsByBooking[booking.id] || [];
      attendeeEmailsBySession =
        attendeeResolution.attendeeEmailsByBookingSession[booking.id] || {};
    } catch (error) {
      const attendeeErrorMessage = getGoogleCalendarSyncErrorMessage(
        error,
        apiText(request, "failedLoadFreelanceAssignments"),
      );
      const updated = await updateBookingCalendarSyncState({
        supabase,
        bookingId: booking.id,
        userId: user.id,
        status: "failed",
        errorMessage: attendeeErrorMessage,
      });
      if (!updated.ok) {
        console.warn(
          "Failed to update booking calendar sync status (failed):",
          updated.error,
        );
      }
      lastErrorMessage = attendeeErrorMessage;
    }

    if (attendeeEmails) {
      const syncResult = await syncSingleBookingCalendar({
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
        attendeeEmails,
        attendeeEmailsBySession: attendeeEmailsBySession || {},
        locale,
        publicOrigin,
        fallbackErrorMessage: apiText(request, "failedSendCalendarInvite"),
      });

      if (syncResult.status === "success") {
        const syncedEventIds = syncResult.eventIds || {};
        const syncedEventId =
          resolveSessionEventId(syncedEventIds, sessionKey) ||
          normalizeOptionalString(syncResult.eventId);

        if (syncedEventId) {
          const syncedOpen = await resolveCanonicalEventUrl({
            accessToken,
            refreshToken,
            eventId: syncedEventId,
            calendarIdHint,
          });

          if (syncedOpen.openUrl) {
            return NextResponse.json({
              success: true,
              mode: "event",
              source: "synced",
              openUrl: syncedOpen.openUrl,
              bookingCode,
            });
          }

          if (syncedOpen.invalidGrant) {
            await clearGoogleCalendarConnection(supabase, user.id);
            return NextResponse.json(
              { success: false, ...buildGoogleInvalidGrantPayload("calendar") },
              { status: 403 },
            );
          }

          if (syncedOpen.errorMessage) {
            lastErrorMessage = syncedOpen.errorMessage;
          }
        }
      } else if (syncResult.errorCode === GOOGLE_INVALID_GRANT_CODE) {
        await clearGoogleCalendarConnection(supabase, user.id);
        return NextResponse.json(
          { success: false, ...buildGoogleInvalidGrantPayload("calendar") },
          { status: 403 },
        );
      } else if (syncResult.errorMessage) {
        lastErrorMessage = syncResult.errorMessage;
      }
    }

    return NextResponse.json({
      success: true,
      mode: "search",
      source: "fallback",
      openUrl: buildGoogleCalendarSearchUrl(bookingCode),
      bookingCode,
      reason: lastErrorMessage,
    });
  } catch (error) {
    if (userId && supabase && isGoogleInvalidGrantError(error)) {
      await clearGoogleCalendarConnection(supabase, userId);
      return NextResponse.json(
        { success: false, ...buildGoogleInvalidGrantPayload("calendar") },
        { status: 403 },
      );
    }

    if (error instanceof BookingWriteAccessDeniedError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }

    const message = getGoogleCalendarSyncErrorMessage(
      error,
      apiText(request, "failedSendCalendarInvite"),
    );

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
