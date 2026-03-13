export type WhatsAppTemplate = {
  type: string;
  content: string;
  content_en: string;
  event_type?: string | null;
};

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
          (template) => template.type === type && template.event_type === eventType,
        )
      : null;
  const fallback =
    templates.find(
      (template) =>
        template.type === type &&
        (!template.event_type || template.event_type === "Umum"),
    ) || templates.find((template) => template.type === type);

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
