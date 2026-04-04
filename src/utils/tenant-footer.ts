import DOMPurify from "isomorphic-dompurify";

const TENANT_FOOTER_ALLOWED_TAGS = ["a", "br", "strong", "b", "em", "i", "u", "span"];
const TENANT_FOOTER_ALLOWED_ATTR = ["href", "target", "rel"];
const TENANT_FOOTER_ALLOWED_URI = /^(?:(?:https?|mailto|tel):|\/(?!\/))/i;

export function sanitizeTenantFooterHtml(rawValue: string | null | undefined) {
  const input = (rawValue || "").trim();
  if (!input) return null;

  const sanitized = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: TENANT_FOOTER_ALLOWED_TAGS,
    ALLOWED_ATTR: TENANT_FOOTER_ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: TENANT_FOOTER_ALLOWED_URI,
  }).trim();

  return sanitized || null;
}
