import { normalizeEventTypeName } from "@/lib/event-type-config";
import { parseSessionDateParts } from "@/utils/format-date";

export type BookingTemplateMode = "normal" | "split";

const SPLIT_CAPABLE_EVENT_TYPES = new Set(["Wedding", "Wisuda"]);

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

export function normalizeBookingTemplateMode(
  value: unknown,
): BookingTemplateMode {
  return value === "split" ? "split" : "normal";
}

export function isSplitCapableBookingEventType(
  eventType: string | null | undefined,
) {
  const normalized = normalizeEventTypeName(eventType);
  return normalized ? SPLIT_CAPABLE_EVENT_TYPES.has(normalized) : false;
}

export function resolveBookingTemplateMode({
  eventType,
  extraFields,
}: {
  eventType?: string | null;
  extraFields?: unknown;
}): BookingTemplateMode {
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
