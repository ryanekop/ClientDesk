const SUPPORTED_PUBLIC_LOCALES = ["id", "en"] as const;
const SUPPORTED_INVOICE_STAGES = ["initial", "final"] as const;

function sanitizeTagValue(value: string | null | undefined, fallback = "unknown") {
  const trimmed = (value || "").trim().toLowerCase();
  if (!trimmed) return fallback;
  return encodeURIComponent(trimmed);
}

export function normalizePublicLocale(locale: string | null | undefined) {
  const normalized = sanitizeTagValue(locale, "id");
  if ((SUPPORTED_PUBLIC_LOCALES as readonly string[]).includes(normalized)) {
    return normalized as (typeof SUPPORTED_PUBLIC_LOCALES)[number];
  }
  return "id";
}

export function normalizeInvoiceStage(stage: string | null | undefined) {
  const normalized = sanitizeTagValue(stage, "initial");
  if ((SUPPORTED_INVOICE_STAGES as readonly string[]).includes(normalized)) {
    return normalized as (typeof SUPPORTED_INVOICE_STAGES)[number];
  }
  return "initial";
}

export function buildVendorCacheTag(vendorSlug: string) {
  return `public:vendor:${sanitizeTagValue(vendorSlug)}`;
}

export function buildVendorUserCacheTag(userId: string) {
  return `public:vendor-user:${sanitizeTagValue(userId)}`;
}

export function buildInvoiceCacheTag(
  bookingCode: string,
  stage: string,
  locale: string,
) {
  return `public:invoice:${sanitizeTagValue(bookingCode)}:${normalizeInvoiceStage(stage)}:${normalizePublicLocale(locale)}`;
}

export function buildInvoiceUserCacheTag(userId: string) {
  return `public:invoice-user:${sanitizeTagValue(userId)}`;
}

export function buildTrackCacheTag(trackingUuid: string, locale: string) {
  return `public:track:${sanitizeTagValue(trackingUuid)}:${normalizePublicLocale(locale)}`;
}

export function buildTrackUserCacheTag(userId: string) {
  return `public:track-user:${sanitizeTagValue(userId)}`;
}

export function buildInvoiceTagsForBooking(bookingCode: string) {
  const tags: string[] = [];
  for (const stage of SUPPORTED_INVOICE_STAGES) {
    for (const locale of SUPPORTED_PUBLIC_LOCALES) {
      tags.push(buildInvoiceCacheTag(bookingCode, stage, locale));
    }
  }
  return tags;
}

export function buildTrackTagsForUuid(trackingUuid: string) {
  return SUPPORTED_PUBLIC_LOCALES.map((locale) =>
    buildTrackCacheTag(trackingUuid, locale),
  );
}
