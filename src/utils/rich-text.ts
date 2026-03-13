import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "h2",
  "h3",
  "blockquote",
  "hr",
];

export function sanitizeRichTextHtml(html: string): string {
  if (!html) return "";

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: [],
  }).trim();
}

export function isRichTextEmpty(html: string): boolean {
  if (!html) return true;

  const sanitized = sanitizeRichTextHtml(html);
  const withoutTags = sanitized
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<hr\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\u00a0/g, " ")
    .trim();

  return withoutTags.length === 0 && !/<li[\s>]/i.test(sanitized);
}
