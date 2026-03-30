function normalizeLocale(value: string | null | undefined): "id" | "en" {
  return value?.trim().toLowerCase() === "en" ? "en" : "id";
}

function normalizeOrigin(candidate: string | null | undefined): string {
  if (!candidate || typeof candidate !== "string") return "";
  const trimmed = candidate.trim();
  if (!trimmed) return "";

  try {
    return new URL(trimmed).origin;
  } catch {
    return "";
  }
}

export function buildBookingDetailLink(args: {
  publicOrigin?: string | null;
  locale?: string | null;
  bookingId: string;
}) {
  const normalizedBookingId = args.bookingId?.trim();
  if (!normalizedBookingId) return "-";

  const origin =
    normalizeOrigin(args.publicOrigin) ||
    normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL) ||
    "http://localhost:3000";
  const locale = normalizeLocale(args.locale);

  return `${origin}/${locale}/bookings/${encodeURIComponent(normalizedBookingId)}`;
}
