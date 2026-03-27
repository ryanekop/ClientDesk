import { resolveBookingFreelancerNames } from "@/lib/booking-freelancers";
import { syncBookingCalendarEvent } from "@/lib/google-calendar-booking";
import {
  getGoogleCalendarSyncErrorMessage,
  isNoScheduleSyncError,
  updateBookingCalendarSyncState,
  type GoogleCalendarSyncStatus,
} from "@/lib/google-calendar-sync";

export const GOOGLE_CALENDAR_SYNC_BOOKING_SELECT =
  "id, booking_code, client_name, client_whatsapp, session_date, location, location_lat, location_lng, location_detail, notes, event_type, extra_fields, google_calendar_event_id, google_calendar_event_ids, services(id, name, duration_minutes, is_addon, affects_schedule), booking_services(id, kind, sort_order, service:services(id, name, duration_minutes, is_addon, affects_schedule)), freelance(name), booking_freelance(freelance(name))";

type SupabaseLike = any;

export type GoogleCalendarSyncBookingRow = {
  id: string;
  booking_code: string;
  client_name: string;
  client_whatsapp: string | null;
  session_date: string | null;
  location: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_detail: string | null;
  notes: string | null;
  event_type: string | null;
  extra_fields: Record<string, unknown> | null;
  google_calendar_event_id: string | null;
  google_calendar_event_ids: unknown;
  services: unknown;
  booking_services?: unknown;
  freelance?: unknown;
  booking_freelance?: unknown;
};

export type GoogleCalendarSyncProfile = {
  accessToken: string;
  refreshToken: string;
  studioName?: string | null;
  eventFormat?: string | null;
  eventFormatMap?: Record<string, string> | null;
  eventDescription?: string | null;
  eventDescriptionMap?: Record<string, string> | null;
};

export type GoogleCalendarSyncSingleResult = {
  status: GoogleCalendarSyncStatus;
  bookingCode: string;
  eventId?: string | null;
  eventIds?: Record<string, string>;
  errorMessage?: string;
};

export async function fetchGoogleCalendarSyncBookings(args: {
  supabase: SupabaseLike;
  userId: string;
  bookingIds: string[];
}) {
  if (args.bookingIds.length === 0) {
    return [] as GoogleCalendarSyncBookingRow[];
  }

  const { data } = await args.supabase
    .from("bookings")
    .select(GOOGLE_CALENDAR_SYNC_BOOKING_SELECT)
    .eq("user_id", args.userId)
    .in("id", args.bookingIds);

  return (data || []) as GoogleCalendarSyncBookingRow[];
}

export async function fetchGoogleCalendarSyncBookingById(args: {
  supabase: SupabaseLike;
  userId: string;
  bookingId: string;
}) {
  const { data, error } = await args.supabase
    .from("bookings")
    .select(GOOGLE_CALENDAR_SYNC_BOOKING_SELECT)
    .eq("id", args.bookingId)
    .eq("user_id", args.userId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as GoogleCalendarSyncBookingRow;
}

export async function syncSingleBookingCalendar(args: {
  supabase: SupabaseLike;
  userId: string;
  booking: GoogleCalendarSyncBookingRow;
  profile: GoogleCalendarSyncProfile;
  attendeeEmails: string[];
  fallbackErrorMessage?: string;
}): Promise<GoogleCalendarSyncSingleResult> {
  try {
    const syncedEvent = await syncBookingCalendarEvent({
      profile: args.profile,
      booking: {
        id: args.booking.id,
        bookingCode: args.booking.booking_code,
        clientName: args.booking.client_name,
        clientWhatsapp: args.booking.client_whatsapp,
        sessionDate: args.booking.session_date,
        location: args.booking.location,
        locationLat: args.booking.location_lat,
        locationLng: args.booking.location_lng,
        locationDetail: args.booking.location_detail,
        eventType: args.booking.event_type,
        notes: args.booking.notes,
        extraFields: args.booking.extra_fields,
        freelancerNames: resolveBookingFreelancerNames({
          bookingFreelance: args.booking.booking_freelance,
          legacyFreelance: args.booking.freelance,
        }),
        googleCalendarEventId: args.booking.google_calendar_event_id,
        googleCalendarEventIds: args.booking.google_calendar_event_ids,
        services: args.booking.services,
        bookingServices: args.booking.booking_services,
      },
      attendeeEmails: args.attendeeEmails,
    });

    const updated = await updateBookingCalendarSyncState({
      supabase: args.supabase,
      bookingId: args.booking.id,
      userId: args.userId,
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

    return {
      status: "success",
      bookingCode: args.booking.booking_code,
      eventId: syncedEvent.eventId,
      eventIds: syncedEvent.eventIds,
    };
  } catch (error) {
    const message = getGoogleCalendarSyncErrorMessage(
      error,
      args.fallbackErrorMessage || "Unknown error",
    );
    const status: GoogleCalendarSyncStatus = isNoScheduleSyncError(error)
      ? "skipped"
      : "failed";

    const updated = await updateBookingCalendarSyncState({
      supabase: args.supabase,
      bookingId: args.booking.id,
      userId: args.userId,
      status,
      errorMessage: message,
    });

    if (!updated.ok) {
      console.warn(
        `Failed to update booking calendar sync status (${status}):`,
        updated.error,
      );
    }

    return {
      status,
      bookingCode: args.booking.booking_code,
      errorMessage: message,
    };
  }
}
