import { resolveBookingCalendarSessions } from "@/lib/booking-calendar-sessions";
import {
  normalizeClientStatusDeadlineDefaultDays,
  normalizeClientStatusDeadlineTriggerStatus,
} from "@/lib/booking-deadline";
import { updateBookingStatusWithQueueTransition } from "@/lib/booking-status-queue";
import { invalidatePublicCachesForBooking } from "@/lib/public-cache-invalidation";
import { createServiceClient } from "@/lib/supabase/service";
import { parseSessionDateParts } from "@/utils/format-date";

type SessionTimeTriggerProfileRow = {
  id: string;
  vendor_slug?: string | null;
  queue_trigger_status?: string | null;
  client_status_deadline_trigger_status?: string | null;
  client_status_deadline_default_days?: number | null;
  session_time_trigger_from_status?: string | null;
  session_time_trigger_to_status?: string | null;
};

type SessionTimeTriggerBookingRow = {
  id: string;
  user_id: string;
  booking_code: string;
  tracking_uuid: string | null;
  session_date: string | null;
  project_deadline_date: string | null;
  event_type: string | null;
  extra_fields?: Record<string, unknown> | null;
  client_status: string | null;
  status: string | null;
};

type SessionTimeStatusSyncError = {
  scope: "profile" | "booking";
  id: string;
  message: string;
};

export type SessionTimeStatusSyncSummary = {
  processedProfiles: number;
  scannedBookings: number;
  dueBookings: number;
  updatedBookings: number;
  skippedBookings: number;
  errorCount: number;
  errors: SessionTimeStatusSyncError[];
};

function normalizeOptionalStatus(value: string | null | undefined) {
  const trimmed = (value || "").trim();
  return trimmed || null;
}

function getLocalDateParts(date: Date) {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hours: date.getHours(),
    minutes: date.getMinutes(),
    seconds: date.getSeconds(),
  };
}

function isSessionTimeDue(
  sessionDate: string | null | undefined,
  nowParts: ReturnType<typeof getLocalDateParts>,
) {
  const sessionParts = parseSessionDateParts(sessionDate);
  if (!sessionParts) return false;

  const sessionValue = Date.UTC(
    sessionParts.year,
    sessionParts.month - 1,
    sessionParts.day,
    sessionParts.hours,
    sessionParts.minutes,
    sessionParts.seconds,
  );
  const nowValue = Date.UTC(
    nowParts.year,
    nowParts.month - 1,
    nowParts.day,
    nowParts.hours,
    nowParts.minutes,
    nowParts.seconds,
  );

  return sessionValue <= nowValue;
}

function hasDueSessionTime(
  booking: Pick<
    SessionTimeTriggerBookingRow,
    "event_type" | "session_date" | "extra_fields"
  >,
  nowParts: ReturnType<typeof getLocalDateParts>,
) {
  const sessions = resolveBookingCalendarSessions({
    eventType: booking.event_type,
    sessionDate: booking.session_date,
    extraFields: booking.extra_fields,
  });

  if (sessions.length === 0) {
    return false;
  }

  return sessions.some((session) => isSessionTimeDue(session.sessionDate, nowParts));
}

function pushSyncError(
  summary: SessionTimeStatusSyncSummary,
  error: SessionTimeStatusSyncError,
) {
  summary.errorCount += 1;
  if (summary.errors.length < 50) {
    summary.errors.push(error);
  }
}

export async function runSessionTimeStatusSync(
  now: Date = new Date(),
): Promise<SessionTimeStatusSyncSummary> {
  const supabase = createServiceClient();
  const summary: SessionTimeStatusSyncSummary = {
    processedProfiles: 0,
    scannedBookings: 0,
    dueBookings: 0,
    updatedBookings: 0,
    skippedBookings: 0,
    errorCount: 0,
    errors: [],
  };
  const nowParts = getLocalDateParts(now);

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select(
      "id, vendor_slug, queue_trigger_status, client_status_deadline_trigger_status, client_status_deadline_default_days, session_time_trigger_from_status, session_time_trigger_to_status",
    )
    .not("session_time_trigger_from_status", "is", null)
    .not("session_time_trigger_to_status", "is", null);

  if (profilesError) {
    throw profilesError;
  }

  const activeProfiles = ((profiles || []) as SessionTimeTriggerProfileRow[]).filter(
    (profile) => {
      const fromStatus = normalizeOptionalStatus(
        profile.session_time_trigger_from_status,
      );
      const toStatus = normalizeOptionalStatus(profile.session_time_trigger_to_status);
      return Boolean(fromStatus && toStatus && fromStatus !== toStatus);
    },
  );

  for (const profile of activeProfiles) {
    const fromStatus = normalizeOptionalStatus(
      profile.session_time_trigger_from_status,
    );
    const toStatus = normalizeOptionalStatus(profile.session_time_trigger_to_status);
    if (!fromStatus || !toStatus || fromStatus === toStatus) {
      continue;
    }

    summary.processedProfiles += 1;

    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select(
        "id, user_id, booking_code, tracking_uuid, session_date, project_deadline_date, event_type, extra_fields, client_status, status",
      )
      .eq("user_id", profile.id)
      .eq("client_status", fromStatus)
      .not("session_date", "is", null)
      .is("archived_at", null);

    if (bookingsError) {
      pushSyncError(summary, {
        scope: "profile",
        id: profile.id,
        message: bookingsError.message,
      });
      continue;
    }

    const bookingRows = (bookings || []) as SessionTimeTriggerBookingRow[];
    summary.scannedBookings += bookingRows.length;

    for (const booking of bookingRows) {
      if (!hasDueSessionTime(booking, nowParts)) {
        summary.skippedBookings += 1;
        continue;
      }

      summary.dueBookings += 1;

      const result = await updateBookingStatusWithQueueTransition({
        supabase,
        bookingId: booking.id,
        previousStatus: booking.client_status || booking.status || fromStatus,
        nextStatus: toStatus,
        queueTriggerStatus: profile.queue_trigger_status,
        currentDeadlineDate: booking.project_deadline_date,
        deadlineTriggerStatus: normalizeClientStatusDeadlineTriggerStatus(
          profile.client_status_deadline_trigger_status,
        ),
        deadlineDefaultDays: normalizeClientStatusDeadlineDefaultDays(
          profile.client_status_deadline_default_days,
        ),
      });

      if (!result.ok) {
        pushSyncError(summary, {
          scope: "booking",
          id: booking.id,
          message: result.errorMessage,
        });
        continue;
      }

      summary.updatedBookings += 1;
      invalidatePublicCachesForBooking({
        bookingCode: booking.booking_code,
        trackingUuid: booking.tracking_uuid,
        vendorSlug: profile.vendor_slug || null,
        userId: booking.user_id,
      });
    }
  }

  return summary;
}
