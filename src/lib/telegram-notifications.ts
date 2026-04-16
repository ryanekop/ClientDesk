import { buildBookingWhatsAppTemplateVars } from "@/lib/booking-whatsapp-template-vars";
import {
  resolveBookingCalendarSessions,
  type BookingCalendarSession,
} from "@/lib/booking-calendar-sessions";
import { buildBookingDetailLink } from "@/lib/booking-detail-link";
import {
  fillWhatsAppTemplate,
  getWhatsAppTemplateContent,
  normalizeWhatsAppNumber,
  resolveWhatsAppTemplateMode,
  type WhatsAppTemplate,
} from "@/lib/whatsapp-template";
import { buildWhatsAppUrl } from "@/utils/whatsapp-link";
import {
  formatSessionDate,
  formatSessionTimeRange,
  parseSessionDateParts,
} from "@/utils/format-date";
import {
  escapeTelegramHtml,
  sendTelegramMessage,
} from "@/utils/telegram";

type TelegramLocale = "id" | "en";

type TelegramProfile = {
  id: string;
  studio_name?: string | null;
  telegram_notifications_enabled?: boolean | null;
  telegram_chat_id?: string | null;
  telegram_language?: string | null;
  telegram_notify_new_booking?: boolean | null;
  telegram_notify_settlement_submitted?: boolean | null;
  telegram_notify_session_h1?: boolean | null;
};

type TelegramBooking = {
  id: string;
  booking_code: string;
  client_name: string;
  client_whatsapp?: string | null;
  instagram?: string | null;
  event_type?: string | null;
  session_date?: string | null;
  total_price?: number | null;
  dp_paid?: number | null;
  location?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  location_detail?: string | null;
  notes?: string | null;
  extra_fields?: unknown;
  drive_folder_url?: string | null;
  payment_proof_url?: string | null;
  payment_method?: string | null;
  payment_source?: unknown;
  final_payment_proof_url?: string | null;
  final_payment_amount?: number | null;
  final_payment_method?: string | null;
  final_payment_source?: unknown;
  services?: { name?: string | null; price?: number | null } | null;
  booking_services?: unknown;
  service_label?: string | null;
  tracking_uuid?: string | null;
};

type SupabaseQueryResult<T = unknown> = {
  data?: T | null;
  error?: { code?: string; message?: string | null } | null;
};

type SupabaseQueryBuilder = {
  insert: (payload: unknown) => SupabaseQueryBuilder;
  update: (payload: unknown) => SupabaseQueryBuilder;
  select: (columns?: string) => SupabaseQueryBuilder;
  eq: (column: string, value: unknown) => SupabaseQueryBuilder;
  in: (column: string, values: unknown[]) => SupabaseQueryBuilder;
  single: <T = unknown>() => Promise<SupabaseQueryResult<T>>;
  then: Promise<SupabaseQueryResult>["then"];
};

type SupabaseLike = {
  from: (table: string) => unknown;
};

const TELEGRAM_LOG_TABLE = "telegram_notification_logs";
const REMINDER_TEMPLATE_TYPE = "whatsapp_session_reminder_client";

function fromTable(supabase: SupabaseLike, table: string): SupabaseQueryBuilder {
  return supabase.from(table) as SupabaseQueryBuilder;
}

function normalizeTelegramLocale(value: unknown): TelegramLocale {
  return value === "en" ? "en" : "id";
}

function telegramEnabled(profile: TelegramProfile | null | undefined) {
  return Boolean(
    profile?.telegram_notifications_enabled &&
      typeof profile.telegram_chat_id === "string" &&
      profile.telegram_chat_id.trim(),
  );
}

function formatCurrency(amount: number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount || 0);
}

function getPaymentSourceLabel(source: unknown) {
  if (!source || typeof source !== "object") return "";
  const record = source as Record<string, unknown>;
  const label = record.label;
  if (typeof label === "string" && label.trim()) return label.trim();
  const bankName = record.bank_name;
  if (typeof bankName === "string" && bankName.trim()) return bankName.trim();
  const type = record.type;
  return typeof type === "string" ? type : "";
}

function formatPaymentMethod(method: string | null | undefined, source: unknown) {
  const sourceLabel = getPaymentSourceLabel(source);
  if (method === "bank") return sourceLabel ? `Bank - ${sourceLabel}` : "Bank";
  if (method === "qris") return sourceLabel || "QRIS";
  if (method === "cash") return "Cash";
  return sourceLabel || method || "-";
}

function buildServiceLabel(booking: TelegramBooking) {
  if (booking.service_label?.trim()) return booking.service_label.trim();
  if (booking.services?.name?.trim()) return booking.services.name.trim();
  return "-";
}

function line(label: string, value: unknown) {
  const rendered = value == null || value === "" ? "-" : String(value);
  return `<b>${escapeTelegramHtml(label)}:</b> ${escapeTelegramHtml(rendered)}`;
}

function linkLine(label: string, url: string | null | undefined) {
  const trimmed = typeof url === "string" ? url.trim() : "";
  if (!trimmed) return line(label, "-");
  return `<b>${escapeTelegramHtml(label)}:</b> <a href="${escapeTelegramHtml(trimmed)}">Buka link</a>`;
}

function dateKeyFromSessionDate(value: string | null | undefined) {
  const parts = parseSessionDateParts(value);
  if (!parts) return null;
  return [
    parts.year,
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
}

function getSessionTimeRangeLabel(booking: TelegramBooking) {
  return formatSessionTimeRange(booking.session_date, 120);
}

async function reserveNotificationLog(args: {
  supabase: SupabaseLike;
  userId: string;
  bookingId?: string | null;
  eventType: string;
  eventKey: string;
  scheduledForDate?: string | null;
}) {
  try {
    const { data, error } = await fromTable(args.supabase, TELEGRAM_LOG_TABLE)
      .insert({
        user_id: args.userId,
        booking_id: args.bookingId || null,
        event_type: args.eventType,
        event_key: args.eventKey,
        scheduled_for_date: args.scheduledForDate || null,
        status: "pending",
      })
      .select("id")
      .single();

    const row = data as { id?: string } | null | undefined;
    if (!error) return { id: row?.id };
    if (error.code === "23505") return { duplicate: true };
    if (error.code === "42P01" || /does not exist/i.test(error.message || "")) {
      console.warn("[Telegram] Notification log table is missing; sending without dedupe.");
      return { id: undefined };
    }
    console.warn("[Telegram] Failed to reserve notification log:", error.message);
    return { id: undefined };
  } catch (error) {
    console.warn("[Telegram] Failed to reserve notification log:", error);
    return { id: undefined };
  }
}

async function finishNotificationLog(args: {
  supabase: SupabaseLike;
  id?: string;
  ok: boolean;
  errorMessage?: string | null;
}) {
  if (!args.id) return;
  try {
    await fromTable(args.supabase, TELEGRAM_LOG_TABLE)
      .update({
        status: args.ok ? "sent" : "failed",
        error_message: args.errorMessage || null,
        sent_at: args.ok ? new Date().toISOString() : null,
      })
      .eq("id", args.id);
  } catch (error) {
    console.warn("[Telegram] Failed to update notification log:", error);
  }
}

async function sendLoggedTelegramNotification(args: {
  supabase: SupabaseLike;
  profile: TelegramProfile;
  bookingId?: string | null;
  eventType: string;
  eventKey: string;
  scheduledForDate?: string | null;
  message: string;
}) {
  const chatId = args.profile.telegram_chat_id?.trim();
  if (!chatId) return { sent: false, skipped: true };

  const reservation = await reserveNotificationLog({
    supabase: args.supabase,
    userId: args.profile.id,
    bookingId: args.bookingId || null,
    eventType: args.eventType,
    eventKey: args.eventKey,
    scheduledForDate: args.scheduledForDate || null,
  });
  if (reservation.duplicate) return { sent: false, skipped: true };

  try {
    const result = await sendTelegramMessage(chatId, args.message);
    await finishNotificationLog({
      supabase: args.supabase,
      id: reservation.id,
      ok: result.ok,
      errorMessage: result.ok ? null : result.description || `HTTP ${result.status}`,
    });
    if (!result.ok) {
      console.error("[Telegram] Notification failed:", {
        eventType: args.eventType,
        eventKey: args.eventKey,
        status: result.status,
        description: result.description || null,
      });
    }
    return { sent: result.ok, skipped: false };
  } catch (error) {
    await finishNotificationLog({
      supabase: args.supabase,
      id: reservation.id,
      ok: false,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    console.error("[Telegram] Notification failed:", {
      eventType: args.eventType,
      eventKey: args.eventKey,
      error,
    });
    return { sent: false, skipped: false };
  }
}

export async function notifyTelegramNewBooking(args: {
  supabase: SupabaseLike;
  profile: TelegramProfile;
  booking: TelegramBooking;
  paymentProofUrl?: string | null;
  publicOrigin?: string | null;
}) {
  if (!telegramEnabled(args.profile) || args.profile.telegram_notify_new_booking === false) {
    return;
  }

  const locale = normalizeTelegramLocale(args.profile.telegram_language);
  const booking = args.booking;
  const detailLink = args.publicOrigin
    ? buildBookingDetailLink({
        publicOrigin: args.publicOrigin,
        locale,
        bookingId: booking.id,
      })
    : null;
  const proofUrl = args.paymentProofUrl || booking.payment_proof_url || null;
  const title =
    locale === "en" ? "New Public Booking" : "Booking Publik Baru";
  const message = [
    `🆕 <b>${escapeTelegramHtml(title)}</b>`,
    "",
    line(locale === "en" ? "Studio" : "Studio", args.profile.studio_name || "-"),
    line(locale === "en" ? "Client" : "Klien", booking.client_name),
    line("WhatsApp", booking.client_whatsapp || "-"),
    line(locale === "en" ? "Booking Code" : "Kode Booking", booking.booking_code),
    line(locale === "en" ? "Event" : "Acara", booking.event_type || "-"),
    line(locale === "en" ? "Package" : "Paket", buildServiceLabel(booking)),
    line(
      locale === "en" ? "Schedule" : "Jadwal",
      formatSessionDate(booking.session_date, { locale, withTime: false }),
    ),
    line(locale === "en" ? "Time" : "Jam", getSessionTimeRangeLabel(booking)),
    line(locale === "en" ? "Location" : "Lokasi", booking.location || "-"),
    "",
    line(locale === "en" ? "Total" : "Total", formatCurrency(booking.total_price)),
    line(locale === "en" ? "DP Paid" : "DP Dibayar", formatCurrency(booking.dp_paid)),
    line(
      locale === "en" ? "Payment" : "Pembayaran",
      formatPaymentMethod(booking.payment_method, booking.payment_source),
    ),
    linkLine(locale === "en" ? "Payment Proof" : "Bukti Pembayaran", proofUrl),
    detailLink ? linkLine(locale === "en" ? "Booking Detail" : "Detail Booking", detailLink) : "",
  ]
    .filter(Boolean)
    .join("\n");

  await sendLoggedTelegramNotification({
    supabase: args.supabase,
    profile: args.profile,
    bookingId: booking.id,
    eventType: "new_booking",
    eventKey: `new_booking:${booking.id}`,
    message,
  });
}

export async function notifyTelegramSettlementSubmitted(args: {
  supabase: SupabaseLike;
  profile: TelegramProfile;
  booking: TelegramBooking;
  proofUrl?: string | null;
  publicOrigin?: string | null;
}) {
  if (
    !telegramEnabled(args.profile) ||
    args.profile.telegram_notify_settlement_submitted === false
  ) {
    return;
  }

  const locale = normalizeTelegramLocale(args.profile.telegram_language);
  const booking = args.booking;
  const detailLink = args.publicOrigin
    ? buildBookingDetailLink({
        publicOrigin: args.publicOrigin,
        locale,
        bookingId: booking.id,
      })
    : null;
  const title =
    locale === "en" ? "Settlement Proof Submitted" : "Bukti Pelunasan Masuk";
  const message = [
    `💸 <b>${escapeTelegramHtml(title)}</b>`,
    "",
    line(locale === "en" ? "Studio" : "Studio", args.profile.studio_name || "-"),
    line(locale === "en" ? "Client" : "Klien", booking.client_name),
    line(locale === "en" ? "Booking Code" : "Kode Booking", booking.booking_code),
    line(locale === "en" ? "Event" : "Acara", booking.event_type || "-"),
    line(
      locale === "en" ? "Amount" : "Nominal",
      formatCurrency(booking.final_payment_amount),
    ),
    line(
      locale === "en" ? "Payment" : "Pembayaran",
      formatPaymentMethod(booking.final_payment_method, booking.final_payment_source),
    ),
    linkLine(locale === "en" ? "Payment Proof" : "Bukti Pembayaran", args.proofUrl),
    detailLink ? linkLine(locale === "en" ? "Booking Detail" : "Detail Booking", detailLink) : "",
  ]
    .filter(Boolean)
    .join("\n");

  await sendLoggedTelegramNotification({
    supabase: args.supabase,
    profile: args.profile,
    bookingId: booking.id,
    eventType: "settlement_submitted",
    eventKey: `settlement_submitted:${booking.id}`,
    message,
  });
}

async function loadReminderTemplates(
  supabase: SupabaseLike,
  userId: string,
): Promise<WhatsAppTemplate[]> {
  const { data } = await fromTable(supabase, "templates")
    .select("type, name, content, content_en, event_type")
    .eq("user_id", userId)
    .in("type", ["whatsapp_client", REMINDER_TEMPLATE_TYPE]);

  if (!Array.isArray(data)) return [];
  return data.map((row: Record<string, unknown>) => ({
    type: String(row.type || ""),
    name: typeof row.name === "string" ? row.name : null,
    content: typeof row.content === "string" ? row.content : "",
    content_en: typeof row.content_en === "string" ? row.content_en : "",
    event_type: typeof row.event_type === "string" ? row.event_type : null,
  }));
}

function buildReminderWhatsAppMessage(args: {
  booking: TelegramBooking;
  session: BookingCalendarSession;
  profile: TelegramProfile;
  templates: WhatsAppTemplate[];
  publicOrigin?: string | null;
}) {
  const locale = normalizeTelegramLocale(args.profile.telegram_language);
  const sessionBooking: TelegramBooking = {
    ...args.booking,
    session_date: args.session.sessionDate,
    location: args.session.location || args.booking.location || null,
  };
  const trackingLink =
    args.publicOrigin && args.booking.tracking_uuid
      ? `${args.publicOrigin}/${locale}/track/${args.booking.tracking_uuid}`
      : null;
  const content = getWhatsAppTemplateContent(
    args.templates,
    REMINDER_TEMPLATE_TYPE,
    locale,
    args.booking.event_type,
    resolveWhatsAppTemplateMode({
      eventType: args.booking.event_type,
      extraFields: args.booking.extra_fields,
    }),
  );
  const baseVars = buildBookingWhatsAppTemplateVars({
    booking: sessionBooking,
    locale,
    studioName: args.profile.studio_name || "",
    trackingLink,
  });
  const vars = {
    ...baseVars,
    session_label: args.session.label || (locale === "en" ? "Session" : "Sesi"),
    reminder_label: locale === "en" ? "tomorrow" : "besok",
  };

  return fillWhatsAppTemplate(content, vars);
}

export async function notifyTelegramSessionReminder(args: {
  supabase: SupabaseLike;
  profile: TelegramProfile;
  booking: TelegramBooking;
  session: BookingCalendarSession;
  targetDateKey: string;
  publicOrigin?: string | null;
}) {
  if (!telegramEnabled(args.profile) || args.profile.telegram_notify_session_h1 === false) {
    return { sent: false, skipped: true };
  }

  const locale = normalizeTelegramLocale(args.profile.telegram_language);
  const templates = await loadReminderTemplates(args.supabase, args.profile.id);
  const waMessage = buildReminderWhatsAppMessage({
    booking: args.booking,
    session: args.session,
    profile: args.profile,
    templates,
    publicOrigin: args.publicOrigin,
  });
  const waNumber = normalizeWhatsAppNumber(args.booking.client_whatsapp);
  const waUrl = waNumber ? buildWhatsAppUrl(waNumber, waMessage) : null;
  const detailLink = args.publicOrigin
    ? buildBookingDetailLink({
        publicOrigin: args.publicOrigin,
        locale,
        bookingId: args.booking.id,
      })
    : null;
  const sessionLabel = args.session.label || (locale === "en" ? "Main session" : "Sesi utama");
  const title =
    locale === "en" ? "Session Reminder H-1" : "Reminder Sesi H-1";
  const message = [
    `⏰ <b>${escapeTelegramHtml(title)}</b>`,
    "",
    line(locale === "en" ? "Studio" : "Studio", args.profile.studio_name || "-"),
    line(locale === "en" ? "Client" : "Klien", args.booking.client_name),
    line("WhatsApp", args.booking.client_whatsapp || "-"),
    line(locale === "en" ? "Booking Code" : "Kode Booking", args.booking.booking_code),
    line(locale === "en" ? "Session" : "Sesi", sessionLabel),
    line(
      locale === "en" ? "Schedule" : "Jadwal",
      formatSessionDate(args.session.sessionDate, { locale, withTime: false }),
    ),
    line(
      locale === "en" ? "Time" : "Jam",
      formatSessionTimeRange(args.session.sessionDate, 120),
    ),
    line(locale === "en" ? "Location" : "Lokasi", args.session.location || "-"),
    waUrl ? linkLine("WhatsApp", waUrl) : line("WhatsApp", locale === "en" ? "Client number is empty" : "Nomor klien kosong"),
    detailLink ? linkLine(locale === "en" ? "Booking Detail" : "Detail Booking", detailLink) : "",
  ]
    .filter(Boolean)
    .join("\n");

  return sendLoggedTelegramNotification({
    supabase: args.supabase,
    profile: args.profile,
    bookingId: args.booking.id,
    eventType: "session_h1",
    eventKey: `session_h1:${args.booking.id}:${args.session.key}:${args.targetDateKey}`,
    scheduledForDate: args.targetDateKey,
    message,
  });
}

export function resolveTelegramReminderSessions(args: {
  booking: TelegramBooking;
  targetDateKey: string;
}) {
  return resolveBookingCalendarSessions({
    eventType: args.booking.event_type,
    sessionDate: args.booking.session_date || null,
    extraFields: args.booking.extra_fields,
    defaultLocation: args.booking.location || null,
  }).filter((session) => dateKeyFromSessionDate(session.sessionDate) === args.targetDateKey);
}

export function getTelegramTestMessage(profile: TelegramProfile) {
  const locale = normalizeTelegramLocale(profile.telegram_language);
  const timestamp = new Date().toLocaleString(locale === "en" ? "en-US" : "id-ID", {
    timeZone: "Asia/Jakarta",
  });

  return [
    `✅ <b>${escapeTelegramHtml(locale === "en" ? "ClientDesk Telegram Test" : "Test Telegram ClientDesk")}</b>`,
    "",
    line(locale === "en" ? "Studio" : "Studio", profile.studio_name || "-"),
    line(locale === "en" ? "Time" : "Waktu", timestamp),
    "",
    escapeTelegramHtml(
      locale === "en"
        ? "If this message arrives, your Telegram notification setup is ready."
        : "Kalau pesan ini masuk, setup notifikasi Telegram sudah siap.",
    ),
  ].join("\n");
}
