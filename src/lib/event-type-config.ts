import { GOOGLE_EVENT_TYPES } from "@/utils/google/template";

export const PUBLIC_CUSTOM_EVENT_TYPE = "Custom/Lainnya";
export const LEGACY_PUBLIC_CUSTOM_EVENT_TYPE = "Lainnya";

const BUILT_IN_EVENT_TYPES = Array.from(
  new Set(
    GOOGLE_EVENT_TYPES.map((item) => normalizeEventTypeName(item)).filter(
      (item): item is string => Boolean(item),
    ),
  ),
);
const BUILT_IN_EVENT_TYPE_SET = new Set<string>(BUILT_IN_EVENT_TYPES);

export function normalizeEventTypeName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized === LEGACY_PUBLIC_CUSTOM_EVENT_TYPE) {
    return PUBLIC_CUSTOM_EVENT_TYPE;
  }
  return normalized;
}

export function isShowAllPackagesEventType(
  eventType: string | null | undefined,
): boolean {
  return normalizeEventTypeName(eventType) === PUBLIC_CUSTOM_EVENT_TYPE;
}

export function normalizeEventTypeMap<T>(
  value: Record<string, T>,
): Record<string, T> {
  const next: Record<string, T> = {};

  Object.entries(value).forEach(([key, entryValue]) => {
    const normalizedKey = normalizeEventTypeName(key);
    if (!normalizedKey) return;

    if (!(normalizedKey in next) || key === normalizedKey) {
      next[normalizedKey] = entryValue;
    }
  });

  return next;
}

export function normalizeEventTypeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const result: string[] = [];

  value.forEach((item) => {
    const normalized = normalizeEventTypeName(item);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });

  return result;
}

export function mergeCustomEventTypes(
  customEventTypes: unknown,
  activeEventTypes?: unknown,
): string[] {
  const normalizedCustom = normalizeEventTypeList(customEventTypes).filter(
    (item) => !BUILT_IN_EVENT_TYPE_SET.has(item),
  );
  if (typeof activeEventTypes === "undefined") {
    return normalizedCustom;
  }
  const inferredFromActive = normalizeEventTypeList(activeEventTypes).filter(
    (item) => !BUILT_IN_EVENT_TYPE_SET.has(item),
  );
  return Array.from(new Set([...normalizedCustom, ...inferredFromActive]));
}

export function getBuiltInEventTypes(): string[] {
  return [...BUILT_IN_EVENT_TYPES];
}

export function getAllEventTypes(
  customEventTypes: unknown,
  activeEventTypes?: unknown,
): string[] {
  const normalizedCustom = mergeCustomEventTypes(
    customEventTypes,
    activeEventTypes,
  );
  return Array.from(new Set([...BUILT_IN_EVENT_TYPES, ...normalizedCustom]));
}

export type EventTypeSetting = {
  name: string;
  builtIn: boolean;
  active: boolean;
};

export function getEventTypeSettings({
  customEventTypes,
  activeEventTypes,
}: {
  customEventTypes: unknown;
  activeEventTypes: unknown;
}): EventTypeSetting[] {
  const normalizedActive = normalizeEventTypeList(activeEventTypes);
  const allEventTypes = getAllEventTypes(customEventTypes, normalizedActive);
  const activeOrder =
    normalizedActive.length > 0
      ? normalizedActive.filter((item) => allEventTypes.includes(item))
      : [...allEventTypes];
  if (
    allEventTypes.includes(PUBLIC_CUSTOM_EVENT_TYPE) &&
    !activeOrder.includes(PUBLIC_CUSTOM_EVENT_TYPE)
  ) {
    activeOrder.push(PUBLIC_CUSTOM_EVENT_TYPE);
  }
  const activeSet = new Set(activeOrder);
  const inactive = allEventTypes.filter((item) => !activeSet.has(item));
  const ordered = [...activeOrder, ...inactive];

  return ordered.map((name) => ({
    name,
    builtIn: BUILT_IN_EVENT_TYPE_SET.has(name),
    active: activeSet.has(name) || normalizedActive.length === 0,
  }));
}

export function getActiveEventTypes({
  customEventTypes,
  activeEventTypes,
}: {
  customEventTypes: unknown;
  activeEventTypes: unknown;
}): string[] {
  return getEventTypeSettings({ customEventTypes, activeEventTypes })
    .filter((item) => item.active)
    .map((item) => item.name);
}

export function getInactiveEventTypes({
  customEventTypes,
  activeEventTypes,
}: {
  customEventTypes: unknown;
  activeEventTypes: unknown;
}): string[] {
  return getEventTypeSettings({ customEventTypes, activeEventTypes })
    .filter((item) => !item.active)
    .map((item) => item.name);
}
