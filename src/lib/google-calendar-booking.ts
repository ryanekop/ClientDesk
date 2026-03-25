import {
  getBookingDurationMinutes,
  getBookingServiceLabel,
  normalizeBookingServiceSelections,
} from "@/lib/booking-services";
import {
  normalizeGoogleCalendarEventIds,
  resolveBookingCalendarSessions,
} from "@/lib/booking-calendar-sessions";
import { formatBookingFreelancerNames } from "@/lib/booking-freelancers";
import {
  DEFAULT_CALENDAR_EVENT_DESCRIPTION,
  DEFAULT_CALENDAR_EVENT_FORMAT,
  applyCalendarTemplate,
  buildCalendarRangeFromStoredSession,
  buildCalendarTemplateVars,
  resolveTemplateByEventType,
  type GoogleCalendarDateTime,
} from "@/utils/google/template";
import { deleteCalendarEvent, upsertCalendarEvent } from "@/utils/google/calendar";
import { buildGoogleMapsUrlOrFallback } from "@/utils/location";

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
  clientWhatsapp?: string | null;
  freelancerNames?: string[] | null;
  sessionDate: string | null;
  location?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  locationDetail?: string | null;
  eventType?: string | null;
  notes?: string | null;
  extraFields?: unknown;
  googleCalendarEventId?: string | null;
  googleCalendarEventIds?: unknown;
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
  eventIds: Record<string, string>;
};

export async function syncBookingCalendarEvent({
  profile,
  booking,
  attendeeEmails = [],
}: SyncBookingCalendarArgs): Promise<BookingCalendarPayload> {
  const sessions = resolveBookingCalendarSessions({
    eventType: booking.eventType,
    sessionDate: booking.sessionDate,
    extraFields: booking.extraFields,
    defaultLocation: booking.location,
  });

  if (sessions.length === 0) {
    throw new Error("Booking belum punya jadwal sesi.");
  }

  const serviceSelections = normalizeBookingServiceSelections(
    booking.bookingServices,
    booking.services,
  );
  const durationMinutes = getBookingDurationMinutes(serviceSelections);
  const serviceName = getBookingServiceLabel(serviceSelections, {
    kind: "main",
    fallback: booking.eventType || "Sesi Foto",
  });
  const existingEventIds = normalizeGoogleCalendarEventIds(
    booking.googleCalendarEventIds,
    booking.googleCalendarEventId,
  );
  const nextEventIds: Record<string, string> = {};
  const activeEventIds = new Set<string>();

  let primarySummary = "";
  let primaryDescription = "";
  let primaryStart: GoogleCalendarDateTime | null = null;
  let primaryEnd: GoogleCalendarDateTime | null = null;
  let primaryEventId: string | null = null;
  const freelanceLabel = formatBookingFreelancerNames(
    Array.isArray(booking.freelancerNames) ? booking.freelancerNames : [],
  );

  for (let index = 0; index < sessions.length; index++) {
    const session = sessions[index];
    const sessionLocation = session.location || booking.location || "-";
    const primaryLocation = booking.location?.trim().toLowerCase();
    const sessionLocationKey = sessionLocation.trim().toLowerCase();
    const useBookingCoords = Boolean(
      primaryLocation &&
        sessionLocationKey &&
        sessionLocationKey === primaryLocation,
    );
    const range = buildCalendarRangeFromStoredSession(
      session.sessionDate,
      durationMinutes,
    );
    const templateVars = buildCalendarTemplateVars(
      {
        client_name: booking.clientName,
        client_whatsapp: booking.clientWhatsapp || "-",
        freelance: freelanceLabel,
        service_name: serviceName,
        event_type: booking.eventType || "-",
        booking_code: booking.bookingCode,
        studio_name: profile.studioName || "Client Desk",
        location: sessionLocation,
        location_maps_url: buildGoogleMapsUrlOrFallback(
          {
            address: sessionLocation,
            lat: useBookingCoords ? booking.locationLat : null,
            lng: useBookingCoords ? booking.locationLng : null,
          },
          "-",
        ),
        detail_location: booking.locationDetail || "-",
        notes: booking.notes || "-",
        ...range.templateVars,
      },
      booking.extraFields,
    );
    const baseSummary = applyCalendarTemplate(
      resolveTemplateByEventType(
        profile.eventFormatMap,
        booking.eventType,
        profile.eventFormat || DEFAULT_CALENDAR_EVENT_FORMAT,
      ),
      templateVars,
    );
    const summary = session.titlePrefix
      ? `${session.titlePrefix} ${baseSummary}`
      : baseSummary;
    const description = applyCalendarTemplate(
      resolveTemplateByEventType(
        profile.eventDescriptionMap,
        booking.eventType,
        profile.eventDescription || DEFAULT_CALENDAR_EVENT_DESCRIPTION,
      ),
      templateVars,
    );

    const previousEventId =
      existingEventIds[session.key] ||
      (index === 0 ? existingEventIds.primary || booking.googleCalendarEventId || undefined : undefined);

    const syncedEvent = await upsertCalendarEvent(
      profile.accessToken,
      profile.refreshToken,
      {
        eventId: previousEventId,
        summary,
        description,
        start: range.start,
        end: range.end,
        attendees: attendeeEmails,
      },
    );
    const resolvedEventId = syncedEvent.id || previousEventId || null;
    if (resolvedEventId) {
      nextEventIds[session.key] = resolvedEventId;
      activeEventIds.add(resolvedEventId);
    }

    if (index === 0) {
      primarySummary = summary;
      primaryDescription = description;
      primaryStart = range.start;
      primaryEnd = range.end;
      primaryEventId = resolvedEventId;
    }
  }

  if (primaryEventId) {
    nextEventIds.primary = primaryEventId;
  }

  const staleEventIds = new Set(
    Object.values(existingEventIds).filter(
      (eventId) => eventId && !activeEventIds.has(eventId),
    ),
  );

  for (const staleEventId of staleEventIds) {
    try {
      await deleteCalendarEvent(profile.accessToken, profile.refreshToken, staleEventId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("Not Found")) {
        throw error;
      }
    }
  }

  if (!primaryStart || !primaryEnd) {
    throw new Error("Gagal menyusun event utama kalender.");
  }

  return {
    summary: primarySummary,
    description: primaryDescription,
    start: primaryStart,
    end: primaryEnd,
    eventId: primaryEventId,
    eventIds: nextEventIds,
  };
}
