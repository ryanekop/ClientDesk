import {
  buildCustomFieldTemplateVars,
} from "@/components/form-builder/booking-form-layout";
import {
  getBookingDurationMinutes,
  normalizeBookingServiceSelections,
  type BookingServiceSelection,
} from "@/lib/booking-services";
import { resolveBookingCalendarSessions } from "@/lib/booking-calendar-sessions";
import { resolveSessionDurationMinutesBySessionKey } from "@/lib/wisuda-session-duration";
import {
  formatSessionTime,
  formatSessionTimeRange,
  formatTemplateSessionDate,
} from "@/utils/format-date";
import {
  buildExtraFieldTemplateVars,
  buildMultiSessionTemplateVars,
} from "@/utils/form-extra-fields";
import { buildGoogleMapsUrlOrFallback } from "@/utils/location";

export const BOOKING_WHATSAPP_TIME_VARIABLES = [
  "{{session_time}}",
  "{{session_start}}",
  "{{session_end}}",
] as const;

type BookingWhatsAppTemplateBooking = {
  client_name: string;
  client_whatsapp?: string | null;
  booking_code: string;
  session_date?: string | null;
  total_price?: number | null;
  dp_paid?: number | null;
  drive_folder_url?: string | null;
  event_type?: string | null;
  location?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  location_detail?: string | null;
  notes?: string | null;
  extra_fields?: unknown;
  service_label?: string | null;
  services?: { name?: string | null; price?: number | null } | null;
  booking_services?: unknown;
  service_selections?: BookingServiceSelection[] | null;
};

type BuildBookingWhatsAppTemplateVarsInput = {
  booking: BookingWhatsAppTemplateBooking;
  locale?: string;
  studioName?: string | null;
  freelancerName?: string | null;
  trackingLink?: string | null;
  invoiceUrl?: string | null;
  totalPriceOverride?: number | null;
};

function resolveTemplateLocale(locale?: string): "id" | "en" {
  return locale === "en" ? "en" : "id";
}

function formatCurrency(amount: number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount || 0);
}

function resolveSessionTimeTemplateVars(
  sessionDate: string | null | undefined,
  durationMinutes: number,
) {
  if (!sessionDate) {
    return {
      session_time: "-",
      session_start: "-",
      session_end: "-",
    };
  }

  const sessionStart = formatSessionTime(sessionDate);
  const sessionTime = formatSessionTimeRange(sessionDate, durationMinutes);
  const sessionEnd =
    sessionTime === "-" ? "-" : sessionTime.split(" - ").at(1) || "-";

  return {
    session_time: sessionTime,
    session_start: sessionStart,
    session_end: sessionEnd,
  };
}

export function buildBookingWhatsAppTemplateVars({
  booking,
  locale,
  studioName,
  freelancerName,
  trackingLink,
  invoiceUrl,
  totalPriceOverride,
}: BuildBookingWhatsAppTemplateVarsInput): Record<string, string> {
  const templateLocale = resolveTemplateLocale(locale);
  const serviceSelections =
    booking.service_selections && booking.service_selections.length > 0
      ? booking.service_selections
      : normalizeBookingServiceSelections(
          booking.booking_services,
          booking.services || null,
        );
  const totalDurationMinutes = getBookingDurationMinutes(serviceSelections);
  const sessions = resolveBookingCalendarSessions({
    eventType: booking.event_type,
    sessionDate: booking.session_date || null,
    extraFields: booking.extra_fields,
    defaultLocation: booking.location || null,
  });
  const durationBySessionKey = resolveSessionDurationMinutesBySessionKey({
    eventType: booking.event_type,
    sessions,
    totalDurationMinutes,
    extraFields: booking.extra_fields,
  });
  const primarySession = sessions.find(
    (session) => session.sessionDate === booking.session_date,
  );
  const primarySessionDurationMinutes = primarySession
    ? durationBySessionKey[primarySession.key] || totalDurationMinutes
    : totalDurationMinutes;
  const sessionDate =
    booking.session_date
      ? formatTemplateSessionDate(booking.session_date, {
          locale: templateLocale,
        })
      : "-";
  const sessionTimeVars = resolveSessionTimeTemplateVars(
    booking.session_date,
    primarySessionDurationMinutes,
  );

  return {
    client_name: booking.client_name,
    client_whatsapp: booking.client_whatsapp || "-",
    booking_code: booking.booking_code,
    session_date: sessionDate,
    ...sessionTimeVars,
    service_name: booking.service_label || booking.services?.name || "-",
    total_price: formatCurrency(totalPriceOverride ?? booking.total_price),
    dp_paid: formatCurrency(booking.dp_paid),
    studio_name: studioName || "",
    freelancer_name: freelancerName || "",
    event_type: booking.event_type || "-",
    location: booking.location || "-",
    location_maps_url: buildGoogleMapsUrlOrFallback(
      {
        address: booking.location,
        lat: booking.location_lat,
        lng: booking.location_lng,
      },
      "-",
    ),
    detail_location: booking.location_detail || "-",
    notes: booking.notes || "-",
    drive_link: booking.drive_folder_url?.trim() || "-",
    tracking_link: trackingLink?.trim() ? trackingLink : "-",
    invoice_url: invoiceUrl?.trim() ? invoiceUrl : "-",
    ...buildExtraFieldTemplateVars(booking.extra_fields),
    ...buildMultiSessionTemplateVars(booking.extra_fields, {
      locale: templateLocale,
      sessionDurationMinutesByKey: durationBySessionKey,
    }),
    ...buildCustomFieldTemplateVars(booking.extra_fields),
  };
}
