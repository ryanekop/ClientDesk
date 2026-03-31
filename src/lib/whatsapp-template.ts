import { normalizeEventTypeName } from "@/lib/event-type-config";
import { parseSessionDateParts } from "@/utils/format-date";

export type WhatsAppTemplate = {
  type: string;
  name?: string | null;
  content: string;
  content_en: string;
  event_type?: string | null;
};

type DefaultTemplateLocale = "id" | "en";
export type WhatsAppTemplateMode = "normal" | "split";

const TEMPLATE_TYPE_NAME_PREFIX = "__template_type__:";
const TEMPLATE_MODE_MARKER = "|mode=";
const ALIASED_TEMPLATE_TYPES = new Set([
  "whatsapp_booking_confirm",
  "whatsapp_settlement_client",
  "whatsapp_settlement_confirm",
]);
const EVENT_SCOPED_WHATSAPP_TEMPLATE_TYPES = new Set([
  "whatsapp_client",
  "whatsapp_freelancer",
  "whatsapp_booking_confirm",
  "whatsapp_settlement_client",
  "whatsapp_settlement_confirm",
]);
const DEFAULT_WHATSAPP_TEMPLATES: Record<
  string,
  Record<DefaultTemplateLocale, string>
> = {
  whatsapp_client: {
    id:
      "Halo {{client_name}}, berikut detail booking {{booking_code}}.\n\n" +
      "Paket: {{service_name}}\n" +
      "Jadwal: {{session_date}}\n" +
      "Total: {{total_price}}\n" +
      "DP Dibayar: {{dp_paid}}\n\n" +
      "Invoice: {{invoice_url}}\n" +
      "Tracking: {{tracking_link}}\n\n" +
      "Terima kasih, {{studio_name}}.",
    en:
      "Hello {{client_name}}, here are your booking details for {{booking_code}}.\n\n" +
      "Package: {{service_name}}\n" +
      "Schedule: {{session_date}}\n" +
      "Total: {{total_price}}\n" +
      "DP Paid: {{dp_paid}}\n\n" +
      "Invoice: {{invoice_url}}\n" +
      "Tracking: {{tracking_link}}\n\n" +
      "Thank you, {{studio_name}}.",
  },
  whatsapp_booking_confirm: {
    id:
      "Halo {{studio_name}}, saya {{client_name}} sudah mengisi form booking.\n\n" +
      "Kode Booking: {{booking_code}}\n" +
      "Paket: {{service_name}}\n" +
      "Jadwal: {{session_date}}\n" +
      "Total: {{total_price}}\n" +
      "DP: {{dp_paid}}\n\n" +
      "Mohon konfirmasi booking saya. Terima kasih.",
    en:
      "Hello {{studio_name}}, I am {{client_name}} and I have submitted the booking form.\n\n" +
      "Booking Code: {{booking_code}}\n" +
      "Package: {{service_name}}\n" +
      "Schedule: {{session_date}}\n" +
      "Total: {{total_price}}\n" +
      "DP: {{dp_paid}}\n\n" +
      "Please confirm my booking. Thank you.",
  },
  whatsapp_settlement_client: {
    id:
      "Halo {{client_name}}, invoice final untuk booking {{booking_code}} sudah tersedia.\n\n" +
      "Paket: {{service_name}}\n" +
      "Total awal: {{total_price}}\n" +
      "Total final: {{final_total}}\n" +
      "Sisa pelunasan: {{remaining_payment}}\n\n" +
      "Invoice final: {{invoice_url}}\n" +
      "Form pelunasan: {{settlement_link}}\n\n" +
      "Terima kasih, {{studio_name}}.",
    en:
      "Hello {{client_name}}, your final invoice for booking {{booking_code}} is ready.\n\n" +
      "Package: {{service_name}}\n" +
      "Base total: {{total_price}}\n" +
      "Final total: {{final_total}}\n" +
      "Remaining payment: {{remaining_payment}}\n\n" +
      "Final invoice: {{invoice_url}}\n" +
      "Settlement form: {{settlement_link}}\n\n" +
      "Thank you, {{studio_name}}.",
  },
  whatsapp_settlement_confirm: {
    id:
      "Halo {{studio_name}}, saya {{client_name}} sudah mengirim pelunasan untuk booking {{booking_code}}.\n\n" +
      "Metode pembayaran: {{payment_method}}\n" +
      "Total final: {{final_total}}\n" +
      "Sisa pelunasan: {{remaining_payment}}\n\n" +
      "Invoice final: {{invoice_url}}\n" +
      "Form pelunasan: {{settlement_link}}\n\n" +
      "Mohon bantu verifikasi. Terima kasih.",
    en:
      "Hello {{studio_name}}, I am {{client_name}} and I have submitted the settlement payment for booking {{booking_code}}.\n\n" +
      "Payment method: {{payment_method}}\n" +
      "Final total: {{final_total}}\n" +
      "Remaining payment: {{remaining_payment}}\n\n" +
      "Final invoice: {{invoice_url}}\n" +
      "Settlement form: {{settlement_link}}\n\n" +
      "Please help verify it. Thank you.",
  },
  whatsapp_freelancer: {
    id:
      "Halo {{freelancer_name}}, ada jadwal baru.\n\n" +
      "Klien: {{client_name}} ({{client_whatsapp}})\n" +
      "Kode Booking: {{booking_code}}\n" +
      "Paket: {{service_name}}\n" +
      "Tanggal: {{session_date}}\n" +
      "Jam: {{session_time}}\n" +
      "Lokasi: {{location}}\n" +
      "Link Drive: {{drive_link}}\n\n" +
      "Mohon konfirmasi kehadiran. Terima kasih, {{studio_name}}.",
    en:
      "Hello {{freelancer_name}}, you have a new assignment.\n\n" +
      "Client: {{client_name}} ({{client_whatsapp}})\n" +
      "Booking Code: {{booking_code}}\n" +
      "Package: {{service_name}}\n" +
      "Date: {{session_date}}\n" +
      "Time: {{session_time}}\n" +
      "Location: {{location}}\n" +
      "Drive Link: {{drive_link}}\n\n" +
      "Please confirm your availability. Thank you, {{studio_name}}.",
  },
};
const DEFAULT_WHATSAPP_SPLIT_TEMPLATES: Record<
  "Wedding" | "Wisuda",
  Record<string, Record<DefaultTemplateLocale, string>>
> = {
  Wedding: {
    whatsapp_client: {
      id:
        "Halo {{client_name}}, berikut detail booking {{booking_code}}.\n\n" +
        "Paket: {{service_name}}\n" +
        "Jadwal:\n" +
        "- Akad: {{akad_date}} {{akad_time}} di {{akad_location}}\n" +
        "- Resepsi: {{resepsi_date}} {{resepsi_time}} di {{resepsi_location}}\n" +
        "Total: {{total_price}}\n" +
        "DP Dibayar: {{dp_paid}}\n\n" +
        "Invoice: {{invoice_url}}\n" +
        "Tracking: {{tracking_link}}\n\n" +
        "Terima kasih, {{studio_name}}.",
      en:
        "Hello {{client_name}}, here are your booking details for {{booking_code}}.\n\n" +
        "Package: {{service_name}}\n" +
        "Schedule:\n" +
        "- Akad: {{akad_date}} {{akad_time}} at {{akad_location}}\n" +
        "- Resepsi: {{resepsi_date}} {{resepsi_time}} at {{resepsi_location}}\n" +
        "Total: {{total_price}}\n" +
        "DP Paid: {{dp_paid}}\n\n" +
        "Invoice: {{invoice_url}}\n" +
        "Tracking: {{tracking_link}}\n\n" +
        "Thank you, {{studio_name}}.",
    },
    whatsapp_booking_confirm: {
      id:
        "Halo {{studio_name}}, saya {{client_name}} sudah mengisi form booking.\n\n" +
        "Kode Booking: {{booking_code}}\n" +
        "Paket: {{service_name}}\n" +
        "Jadwal:\n" +
        "- Akad: {{akad_date}} {{akad_time}} di {{akad_location}}\n" +
        "- Resepsi: {{resepsi_date}} {{resepsi_time}} di {{resepsi_location}}\n" +
        "Total: {{total_price}}\n" +
        "DP: {{dp_paid}}\n\n" +
        "Mohon konfirmasi booking saya. Terima kasih.",
      en:
        "Hello {{studio_name}}, I am {{client_name}} and I have submitted the booking form.\n\n" +
        "Booking Code: {{booking_code}}\n" +
        "Package: {{service_name}}\n" +
        "Schedule:\n" +
        "- Akad: {{akad_date}} {{akad_time}} at {{akad_location}}\n" +
        "- Resepsi: {{resepsi_date}} {{resepsi_time}} at {{resepsi_location}}\n" +
        "Total: {{total_price}}\n" +
        "DP: {{dp_paid}}\n\n" +
        "Please confirm my booking. Thank you.",
    },
    whatsapp_freelancer: {
      id:
        "Halo {{freelancer_name}}, ada jadwal baru.\n\n" +
        "Klien: {{client_name}} ({{client_whatsapp}})\n" +
        "Kode Booking: {{booking_code}}\n" +
        "Paket: {{service_name}}\n" +
        "Jadwal:\n" +
        "- Akad: {{akad_date}} {{akad_time}} di {{akad_location}}\n" +
        "- Resepsi: {{resepsi_date}} {{resepsi_time}} di {{resepsi_location}}\n" +
        "Link Drive: {{drive_link}}\n\n" +
        "Mohon konfirmasi kehadiran. Terima kasih, {{studio_name}}.",
      en:
        "Hello {{freelancer_name}}, you have a new assignment.\n\n" +
        "Client: {{client_name}} ({{client_whatsapp}})\n" +
        "Booking Code: {{booking_code}}\n" +
        "Package: {{service_name}}\n" +
        "Schedule:\n" +
        "- Akad: {{akad_date}} {{akad_time}} at {{akad_location}}\n" +
        "- Resepsi: {{resepsi_date}} {{resepsi_time}} at {{resepsi_location}}\n" +
        "Drive Link: {{drive_link}}\n\n" +
        "Please confirm your availability. Thank you, {{studio_name}}.",
    },
    whatsapp_settlement_client: {
      id:
        "Halo {{client_name}}, invoice final untuk booking {{booking_code}} sudah tersedia.\n\n" +
        "Paket: {{service_name}}\n" +
        "Jadwal:\n" +
        "- Akad: {{akad_date}} {{akad_time}} di {{akad_location}}\n" +
        "- Resepsi: {{resepsi_date}} {{resepsi_time}} di {{resepsi_location}}\n" +
        "Total awal: {{total_price}}\n" +
        "Total final: {{final_total}}\n" +
        "Sisa pelunasan: {{remaining_payment}}\n\n" +
        "Invoice final: {{invoice_url}}\n" +
        "Form pelunasan: {{settlement_link}}\n\n" +
        "Terima kasih, {{studio_name}}.",
      en:
        "Hello {{client_name}}, your final invoice for booking {{booking_code}} is ready.\n\n" +
        "Package: {{service_name}}\n" +
        "Schedule:\n" +
        "- Akad: {{akad_date}} {{akad_time}} at {{akad_location}}\n" +
        "- Resepsi: {{resepsi_date}} {{resepsi_time}} at {{resepsi_location}}\n" +
        "Base total: {{total_price}}\n" +
        "Final total: {{final_total}}\n" +
        "Remaining payment: {{remaining_payment}}\n\n" +
        "Final invoice: {{invoice_url}}\n" +
        "Settlement form: {{settlement_link}}\n\n" +
        "Thank you, {{studio_name}}.",
    },
    whatsapp_settlement_confirm: {
      id:
        "Halo {{studio_name}}, saya {{client_name}} sudah mengirim pelunasan untuk booking {{booking_code}}.\n\n" +
        "Jadwal:\n" +
        "- Akad: {{akad_date}} {{akad_time}} di {{akad_location}}\n" +
        "- Resepsi: {{resepsi_date}} {{resepsi_time}} di {{resepsi_location}}\n" +
        "Metode pembayaran: {{payment_method}}\n" +
        "Total final: {{final_total}}\n" +
        "Sisa pelunasan: {{remaining_payment}}\n\n" +
        "Invoice final: {{invoice_url}}\n" +
        "Form pelunasan: {{settlement_link}}\n\n" +
        "Mohon bantu verifikasi. Terima kasih.",
      en:
        "Hello {{studio_name}}, I am {{client_name}} and I have submitted the settlement payment for booking {{booking_code}}.\n\n" +
        "Schedule:\n" +
        "- Akad: {{akad_date}} {{akad_time}} at {{akad_location}}\n" +
        "- Resepsi: {{resepsi_date}} {{resepsi_time}} at {{resepsi_location}}\n" +
        "Payment method: {{payment_method}}\n" +
        "Final total: {{final_total}}\n" +
        "Remaining payment: {{remaining_payment}}\n\n" +
        "Final invoice: {{invoice_url}}\n" +
        "Settlement form: {{settlement_link}}\n\n" +
        "Please help verify it. Thank you.",
    },
  },
  Wisuda: {
    whatsapp_client: {
      id:
        "Halo {{client_name}}, berikut detail booking {{booking_code}}.\n\n" +
        "Paket: {{service_name}}\n" +
        "Jadwal:\n" +
        "- Sesi 1: {{wisuda_session_1_date}} {{wisuda_session_1_time_range}} di {{wisuda_session_1_location}}\n" +
        "- Sesi 2: {{wisuda_session_2_date}} {{wisuda_session_2_time_range}} di {{wisuda_session_2_location}}\n" +
        "Total: {{total_price}}\n" +
        "DP Dibayar: {{dp_paid}}\n\n" +
        "Invoice: {{invoice_url}}\n" +
        "Tracking: {{tracking_link}}\n\n" +
        "Terima kasih, {{studio_name}}.",
      en:
        "Hello {{client_name}}, here are your booking details for {{booking_code}}.\n\n" +
        "Package: {{service_name}}\n" +
        "Schedule:\n" +
        "- Session 1: {{wisuda_session_1_date}} {{wisuda_session_1_time_range}} at {{wisuda_session_1_location}}\n" +
        "- Session 2: {{wisuda_session_2_date}} {{wisuda_session_2_time_range}} at {{wisuda_session_2_location}}\n" +
        "Total: {{total_price}}\n" +
        "DP Paid: {{dp_paid}}\n\n" +
        "Invoice: {{invoice_url}}\n" +
        "Tracking: {{tracking_link}}\n\n" +
        "Thank you, {{studio_name}}.",
    },
    whatsapp_booking_confirm: {
      id:
        "Halo {{studio_name}}, saya {{client_name}} sudah mengisi form booking.\n\n" +
        "Kode Booking: {{booking_code}}\n" +
        "Paket: {{service_name}}\n" +
        "Jadwal:\n" +
        "- Sesi 1: {{wisuda_session_1_date}} {{wisuda_session_1_time_range}} di {{wisuda_session_1_location}}\n" +
        "- Sesi 2: {{wisuda_session_2_date}} {{wisuda_session_2_time_range}} di {{wisuda_session_2_location}}\n" +
        "Total: {{total_price}}\n" +
        "DP: {{dp_paid}}\n\n" +
        "Mohon konfirmasi booking saya. Terima kasih.",
      en:
        "Hello {{studio_name}}, I am {{client_name}} and I have submitted the booking form.\n\n" +
        "Booking Code: {{booking_code}}\n" +
        "Package: {{service_name}}\n" +
        "Schedule:\n" +
        "- Session 1: {{wisuda_session_1_date}} {{wisuda_session_1_time_range}} at {{wisuda_session_1_location}}\n" +
        "- Session 2: {{wisuda_session_2_date}} {{wisuda_session_2_time_range}} at {{wisuda_session_2_location}}\n" +
        "Total: {{total_price}}\n" +
        "DP: {{dp_paid}}\n\n" +
        "Please confirm my booking. Thank you.",
    },
    whatsapp_freelancer: {
      id:
        "Halo {{freelancer_name}}, ada jadwal baru.\n\n" +
        "Klien: {{client_name}} ({{client_whatsapp}})\n" +
        "Kode Booking: {{booking_code}}\n" +
        "Paket: {{service_name}}\n" +
        "Jadwal:\n" +
        "- Sesi 1: {{wisuda_session_1_date}} {{wisuda_session_1_time_range}} di {{wisuda_session_1_location}}\n" +
        "- Sesi 2: {{wisuda_session_2_date}} {{wisuda_session_2_time_range}} di {{wisuda_session_2_location}}\n" +
        "Link Drive: {{drive_link}}\n\n" +
        "Mohon konfirmasi kehadiran. Terima kasih, {{studio_name}}.",
      en:
        "Hello {{freelancer_name}}, you have a new assignment.\n\n" +
        "Client: {{client_name}} ({{client_whatsapp}})\n" +
        "Booking Code: {{booking_code}}\n" +
        "Package: {{service_name}}\n" +
        "Schedule:\n" +
        "- Session 1: {{wisuda_session_1_date}} {{wisuda_session_1_time_range}} at {{wisuda_session_1_location}}\n" +
        "- Session 2: {{wisuda_session_2_date}} {{wisuda_session_2_time_range}} at {{wisuda_session_2_location}}\n" +
        "Drive Link: {{drive_link}}\n\n" +
        "Please confirm your availability. Thank you, {{studio_name}}.",
    },
    whatsapp_settlement_client: {
      id:
        "Halo {{client_name}}, invoice final untuk booking {{booking_code}} sudah tersedia.\n\n" +
        "Paket: {{service_name}}\n" +
        "Jadwal:\n" +
        "- Sesi 1: {{wisuda_session_1_date}} {{wisuda_session_1_time_range}} di {{wisuda_session_1_location}}\n" +
        "- Sesi 2: {{wisuda_session_2_date}} {{wisuda_session_2_time_range}} di {{wisuda_session_2_location}}\n" +
        "Total awal: {{total_price}}\n" +
        "Total final: {{final_total}}\n" +
        "Sisa pelunasan: {{remaining_payment}}\n\n" +
        "Invoice final: {{invoice_url}}\n" +
        "Form pelunasan: {{settlement_link}}\n\n" +
        "Terima kasih, {{studio_name}}.",
      en:
        "Hello {{client_name}}, your final invoice for booking {{booking_code}} is ready.\n\n" +
        "Package: {{service_name}}\n" +
        "Schedule:\n" +
        "- Session 1: {{wisuda_session_1_date}} {{wisuda_session_1_time_range}} at {{wisuda_session_1_location}}\n" +
        "- Session 2: {{wisuda_session_2_date}} {{wisuda_session_2_time_range}} at {{wisuda_session_2_location}}\n" +
        "Base total: {{total_price}}\n" +
        "Final total: {{final_total}}\n" +
        "Remaining payment: {{remaining_payment}}\n\n" +
        "Final invoice: {{invoice_url}}\n" +
        "Settlement form: {{settlement_link}}\n\n" +
        "Thank you, {{studio_name}}.",
    },
    whatsapp_settlement_confirm: {
      id:
        "Halo {{studio_name}}, saya {{client_name}} sudah mengirim pelunasan untuk booking {{booking_code}}.\n\n" +
        "Jadwal:\n" +
        "- Sesi 1: {{wisuda_session_1_date}} {{wisuda_session_1_time_range}} di {{wisuda_session_1_location}}\n" +
        "- Sesi 2: {{wisuda_session_2_date}} {{wisuda_session_2_time_range}} di {{wisuda_session_2_location}}\n" +
        "Metode pembayaran: {{payment_method}}\n" +
        "Total final: {{final_total}}\n" +
        "Sisa pelunasan: {{remaining_payment}}\n\n" +
        "Invoice final: {{invoice_url}}\n" +
        "Form pelunasan: {{settlement_link}}\n\n" +
        "Mohon bantu verifikasi. Terima kasih.",
      en:
        "Hello {{studio_name}}, I am {{client_name}} and I have submitted the settlement payment for booking {{booking_code}}.\n\n" +
        "Schedule:\n" +
        "- Session 1: {{wisuda_session_1_date}} {{wisuda_session_1_time_range}} at {{wisuda_session_1_location}}\n" +
        "- Session 2: {{wisuda_session_2_date}} {{wisuda_session_2_time_range}} at {{wisuda_session_2_location}}\n" +
        "Payment method: {{payment_method}}\n" +
        "Final total: {{final_total}}\n" +
        "Remaining payment: {{remaining_payment}}\n\n" +
        "Final invoice: {{invoice_url}}\n" +
        "Settlement form: {{settlement_link}}\n\n" +
        "Please help verify it. Thank you.",
    },
  },
};

function normalizeTemplateMode(value: unknown): WhatsAppTemplateMode {
  return value === "split" ? "split" : "normal";
}

function parseTemplateNameMetadata(name: string | null | undefined) {
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  if (!trimmed.startsWith(TEMPLATE_TYPE_NAME_PREFIX)) return null;
  const payload = trimmed.slice(TEMPLATE_TYPE_NAME_PREFIX.length).trim();
  if (!payload) return null;
  const [typePart, modePart] = payload.split(TEMPLATE_MODE_MARKER);
  const type = typePart?.trim();
  if (!type) return null;
  return {
    type,
    mode: normalizeTemplateMode(modePart?.trim()),
  };
}

function isGeneralTemplateEventType(eventType: string | null | undefined) {
  const normalized = normalizeEventTypeName(eventType);
  if (normalized) {
    return normalized === "Umum";
  }
  if (typeof eventType !== "string") {
    return true;
  }
  const trimmed = eventType.trim();
  return trimmed.length === 0 || trimmed.toLowerCase() === "umum";
}

function normalizeExtraFields(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function hasValidDateTime(value: unknown) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return Boolean(parseSessionDateParts(trimmed));
}

export function isEventScopedWhatsAppTemplateType(type: string) {
  return EVENT_SCOPED_WHATSAPP_TEMPLATE_TYPES.has(type);
}

export function resolveWhatsAppTemplateMode({
  eventType,
  extraFields,
}: {
  eventType?: string | null;
  extraFields?: unknown;
}): WhatsAppTemplateMode {
  const normalizedEventType = normalizeEventTypeName(eventType);
  if (!normalizedEventType) return "normal";
  const extras = normalizeExtraFields(extraFields);

  if (
    normalizedEventType === "Wedding" &&
    hasValidDateTime(extras.tanggal_akad) &&
    hasValidDateTime(extras.tanggal_resepsi)
  ) {
    return "split";
  }
  if (
    normalizedEventType === "Wisuda" &&
    hasValidDateTime(extras.tanggal_wisuda_1) &&
    hasValidDateTime(extras.tanggal_wisuda_2)
  ) {
    return "split";
  }

  return "normal";
}

export function resolveTemplateType(template: { type: string; name?: string | null }) {
  const metadata = parseTemplateNameMetadata(template.name);
  if (metadata) {
    return metadata.type;
  }
  return template.type;
}

export function resolveTemplateMode(template: { name?: string | null }) {
  const metadata = parseTemplateNameMetadata(template.name);
  return metadata?.mode || "normal";
}

export function getStoredTemplateType(type: string) {
  return ALIASED_TEMPLATE_TYPES.has(type) ? "whatsapp_client" : type;
}

export function getStoredTemplateName(
  type: string,
  fallbackName: string,
  mode: WhatsAppTemplateMode = "normal",
) {
  if (isEventScopedWhatsAppTemplateType(type) || ALIASED_TEMPLATE_TYPES.has(type)) {
    return `${TEMPLATE_TYPE_NAME_PREFIX}${type}${TEMPLATE_MODE_MARKER}${normalizeTemplateMode(mode)}`;
  }
  return fallbackName;
}

export function getDefaultWhatsAppTemplate(
  type: string,
  locale: string,
  options: {
    eventType?: string | null;
    mode?: WhatsAppTemplateMode;
  } = {},
) {
  const normalizedMode = normalizeTemplateMode(options.mode);
  const normalizedEventType = normalizeEventTypeName(options.eventType);
  if (normalizedMode === "split" && normalizedEventType) {
    const splitDefaults = DEFAULT_WHATSAPP_SPLIT_TEMPLATES[normalizedEventType as "Wedding" | "Wisuda"]?.[type];
    if (splitDefaults) {
      return locale === "en" ? splitDefaults.en : splitDefaults.id;
    }
  }

  const defaults = DEFAULT_WHATSAPP_TEMPLATES[type];
  if (!defaults) return "";
  return locale === "en" ? defaults.en : defaults.id;
}

export function fillWhatsAppTemplate(
  content: string,
  variables: Record<string, string>,
) {
  return content.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return variables[key] ?? `{{${key}}}`;
  });
}

export function getWhatsAppTemplateContent(
  templates: WhatsAppTemplate[],
  type: string,
  locale: string,
  eventType?: string | null,
  mode: WhatsAppTemplateMode = "normal",
) {
  const normalizedMode = normalizeTemplateMode(mode);
  const normalizedEventType = normalizeEventTypeName(eventType);
  const findEventScopedTemplate = (
    targetEventType: string,
    targetMode: WhatsAppTemplateMode,
  ) =>
    templates.find(
      (template) =>
        resolveTemplateType(template) === type &&
        resolveTemplateMode(template) === targetMode &&
        normalizeEventTypeName(template.event_type) === targetEventType,
    );
  const findGeneralTemplate = (targetMode: WhatsAppTemplateMode) =>
    templates.find(
      (template) =>
        resolveTemplateType(template) === type &&
        resolveTemplateMode(template) === targetMode &&
        isGeneralTemplateEventType(template.event_type),
    );
  const findAnyTemplateByMode = (targetMode: WhatsAppTemplateMode) =>
    templates.find(
      (template) =>
        resolveTemplateType(template) === type &&
        resolveTemplateMode(template) === targetMode,
    );

  const selected =
    (normalizedEventType
      ? findEventScopedTemplate(normalizedEventType, normalizedMode)
      : null) ||
    (normalizedEventType && normalizedMode === "split"
      ? findEventScopedTemplate(normalizedEventType, "normal")
      : null) ||
    findGeneralTemplate(normalizedMode) ||
    (normalizedMode === "split" ? findGeneralTemplate("normal") : null) ||
    findAnyTemplateByMode(normalizedMode) ||
    (normalizedMode === "split" ? findAnyTemplateByMode("normal") : null) ||
    templates.find((template) => resolveTemplateType(template) === type);

  const resolved = locale === "en"
    ? selected?.content_en || selected?.content || ""
    : selected?.content || selected?.content_en || "";
  if (resolved.trim()) return resolved;

  return getDefaultWhatsAppTemplate(type, locale, {
    eventType,
    mode: normalizedMode,
  });
}

export function normalizeWhatsAppNumber(phone: string | null | undefined) {
  if (!phone) return "";
  return phone.replace(/^0/, "62").replace(/[^0-9]/g, "");
}
