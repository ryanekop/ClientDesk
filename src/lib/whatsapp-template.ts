export type WhatsAppTemplate = {
  type: string;
  name?: string | null;
  content: string;
  content_en: string;
  event_type?: string | null;
};

const TEMPLATE_TYPE_NAME_PREFIX = "__template_type__:";
const ALIASED_TEMPLATE_TYPES = new Set([
  "whatsapp_booking_confirm",
  "whatsapp_settlement_client",
  "whatsapp_settlement_confirm",
]);

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
  if (!selected) return "";

  if (locale === "en") {
    return selected.content_en || selected.content || "";
  }

  return selected.content || selected.content_en || "";
}

export function normalizeWhatsAppNumber(phone: string | null | undefined) {
  if (!phone) return "";
  return phone.replace(/^0/, "62").replace(/[^0-9]/g, "");
}
