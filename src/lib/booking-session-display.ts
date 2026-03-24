import { resolveBookingCalendarSessions } from "@/lib/booking-calendar-sessions";
import {
  getBookingDurationMinutes,
  normalizeBookingServiceSelections,
  type BookingServiceSelection,
} from "@/lib/booking-services";
import {
  formatSessionDate,
  formatSessionTimeRange,
} from "@/utils/format-date";

type BookingSessionDisplayArgs = {
  eventType?: string | null;
  sessionDate?: string | null;
  extraFields?: unknown;
  bookingServices?: unknown;
  legacyService?: unknown;
  serviceSelections?: BookingServiceSelection[];
  locale?: "id" | "en";
};

export type BookingSessionDisplay = {
  dateDisplay: string;
  timeDisplay: string;
};

export function buildBookingSessionDisplay({
  eventType,
  sessionDate,
  extraFields,
  bookingServices,
  legacyService,
  serviceSelections,
  locale = "id",
}: BookingSessionDisplayArgs): BookingSessionDisplay {
  const sessions = resolveBookingCalendarSessions({
    eventType,
    sessionDate,
    extraFields,
  });
  if (sessions.length === 0) {
    return {
      dateDisplay: "-",
      timeDisplay: "-",
    };
  }

  const normalizedSelections =
    serviceSelections && serviceSelections.length > 0
      ? serviceSelections
      : normalizeBookingServiceSelections(bookingServices, legacyService);
  const durationMinutes = getBookingDurationMinutes(normalizedSelections);
  const dateDisplay = sessions
    .map((session) => {
      const label = formatSessionDate(session.sessionDate, {
        locale,
        withDay: false,
        withTime: false,
        dateOnly: true,
      });
      return session.label ? `${session.label}: ${label}` : label;
    })
    .join("\n");
  const timeDisplay = sessions
    .map((session) => {
      const label = formatSessionTimeRange(session.sessionDate, durationMinutes);
      return session.label ? `${session.label}: ${label}` : label;
    })
    .join("\n");

  return {
    dateDisplay,
    timeDisplay,
  };
}
