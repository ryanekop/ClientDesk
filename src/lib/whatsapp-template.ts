export type WhatsAppTemplate = {
  type: string;
  name?: string | null;
  content: string;
  content_en: string;
  event_type?: string | null;
};

type DefaultTemplateLocale = "id" | "en";

const TEMPLATE_TYPE_NAME_PREFIX = "__template_type__:";
const ALIASED_TEMPLATE_TYPES = new Set([
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
      "Lokasi: {{location}}\n\n" +
      "Mohon konfirmasi kehadiran. Terima kasih, {{studio_name}}.",
    en:
      "Hello {{freelancer_name}}, you have a new assignment.\n\n" +
      "Client: {{client_name}} ({{client_whatsapp}})\n" +
      "Booking Code: {{booking_code}}\n" +
      "Package: {{service_name}}\n" +
      "Date: {{session_date}}\n" +
      "Time: {{session_time}}\n" +
      "Location: {{location}}\n\n" +
      "Please confirm your availability. Thank you, {{studio_name}}.",
  },
};

export function resolveTemplateType(template: { type: string; name?: string | null }) {
  if (template.name?.startsWith(TEMPLATE_TYPE_NAME_PREFIX)) {
    return template.name.slice(TEMPLATE_TYPE_NAME_PREFIX.length);
  }
  return template.type;
}

export function getStoredTemplateType(type: string) {
  return ALIASED_TEMPLATE_TYPES.has(type) ? "whatsapp_client" : type;
}

export function getStoredTemplateName(type: string, fallbackName: string) {
  return ALIASED_TEMPLATE_TYPES.has(type)
    ? `${TEMPLATE_TYPE_NAME_PREFIX}${type}`
    : fallbackName;
}

export function getDefaultWhatsAppTemplate(
  type: string,
  locale: string,
) {
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
) {
  const exact =
    eventType != null
      ? templates.find(
          (template) =>
            resolveTemplateType(template) === type &&
            template.event_type === eventType,
        )
      : null;
  const fallback =
    templates.find(
      (template) =>
        resolveTemplateType(template) === type &&
        (!template.event_type || template.event_type === "Umum"),
    ) || templates.find((template) => resolveTemplateType(template) === type);

  const selected = exact || fallback;
  const resolved = locale === "en"
    ? selected?.content_en || selected?.content || ""
    : selected?.content || selected?.content_en || "";
  if (resolved.trim()) return resolved;

  return getDefaultWhatsAppTemplate(type, locale);
}

export function normalizeWhatsAppNumber(phone: string | null | undefined) {
  if (!phone) return "";
  return phone.replace(/^0/, "62").replace(/[^0-9]/g, "");
}
