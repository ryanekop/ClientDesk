import { normalizeEventTypeName } from "@/lib/event-type-config";
import { resolveSplitSessionDateTimes } from "@/lib/split-session-extra-fields";

export type BookingTemplateMode = "normal" | "split";

const SPLIT_CAPABLE_EVENT_TYPES = new Set(["Wedding", "Wisuda"]);

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
  const splitSessionDateTimes = resolveSplitSessionDateTimes(extraFields);

  if (
    normalizedEventType === "Wedding" &&
    splitSessionDateTimes.akad &&
    splitSessionDateTimes.resepsi
  ) {
    return "split";
  }
  if (
    normalizedEventType === "Wisuda" &&
    splitSessionDateTimes.wisudaSession1 &&
    splitSessionDateTimes.wisudaSession2
  ) {
    return "split";
  }

  return "normal";
}
