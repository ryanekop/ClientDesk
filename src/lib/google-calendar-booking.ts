import {
  getBookingServiceLabel,
  getBookingServicesByKind,
  normalizeBookingServiceSelections,
} from "@/lib/booking-services";
import {
  DEFAULT_CALENDAR_EVENT_DESCRIPTION,
  DEFAULT_CALENDAR_EVENT_FORMAT,
  applyCalendarTemplate,
  buildCalendarRangeFromStoredSession,
  buildCalendarTemplateVars,
  resolveTemplateByEventType,
  type GoogleCalendarDateTime,
} from "@/utils/google/template";
import { upsertCalendarEvent } from "@/utils/google/calendar";

type CalendarProfileConfig = {
  accessToken: string;
  refreshToken: string;
  studioName?: string | null;
  eventFormat?: string | null;
  eventFormatMap?: Record<string, string> | null;
  eventDescription?: string | null;
  eventDescriptionMap?: Record<string, string> | null;
};

type CalendarBookingConfig = {
  id: string;
  bookingCode: string;
  clientName: string;
  sessionDate: string | null;
  location?: string | null;
  eventType?: string | null;
  extraFields?: unknown;
  googleCalendarEventId?: string | null;
  services?: unknown;
  bookingServices?: unknown;
};

type SyncBookingCalendarArgs = {
  profile: CalendarProfileConfig;
  booking: CalendarBookingConfig;
  attendeeEmails?: string[];
};

type BookingCalendarPayload = {
  summary: string;
  description: string;
  start: GoogleCalendarDateTime;
  end: GoogleCalendarDateTime;
  eventId: string | null;
};

export async function syncBookingCalendarEvent({
  profile,
  booking,
  attendeeEmails = [],
}: SyncBookingCalendarArgs): Promise<BookingCalendarPayload> {
  if (!booking.sessionDate) {
    throw new Error("Booking belum punya jadwal sesi.");
  }

  const serviceSelections = normalizeBookingServiceSelections(
    booking.bookingServices,
    booking.services,
  );
  const mainServices = getBookingServicesByKind(serviceSelections, "main");
  const durationMinutes =
    mainServices.reduce(
      (sum, selection) => sum + (selection.service.duration_minutes || 0),
      0,
    ) ||
    serviceSelections[0]?.service.duration_minutes ||
    120;
  const range = buildCalendarRangeFromStoredSession(
    booking.sessionDate,
    durationMinutes,
  );
  const templateVars = buildCalendarTemplateVars(
    {
      client_name: booking.clientName,
      service_name: getBookingServiceLabel(serviceSelections, {
        kind: "main",
        fallback: booking.eventType || "Sesi Foto",
      }),
      event_type: booking.eventType || "-",
      booking_code: booking.bookingCode,
      studio_name: profile.studioName || "Client Desk",
      location: booking.location || "-",
      ...range.templateVars,
    },
    booking.extraFields,
  );
  const summary = applyCalendarTemplate(
    resolveTemplateByEventType(
      profile.eventFormatMap,
      booking.eventType,
      profile.eventFormat || DEFAULT_CALENDAR_EVENT_FORMAT,
    ),
    templateVars,
  );
  const description = applyCalendarTemplate(
    resolveTemplateByEventType(
      profile.eventDescriptionMap,
      booking.eventType,
      profile.eventDescription || DEFAULT_CALENDAR_EVENT_DESCRIPTION,
    ),
    templateVars,
  );

  const syncedEvent = await upsertCalendarEvent(
    profile.accessToken,
    profile.refreshToken,
    {
      eventId: booking.googleCalendarEventId || undefined,
      summary,
      description,
      start: range.start,
      end: range.end,
      attendees: attendeeEmails,
    },
  );

  return {
    summary,
    description,
    start: range.start,
    end: range.end,
    eventId: syncedEvent.id || booking.googleCalendarEventId || null,
  };
}
