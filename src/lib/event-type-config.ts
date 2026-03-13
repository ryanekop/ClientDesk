import { GOOGLE_EVENT_TYPES } from "@/utils/google/template";

export const PUBLIC_CUSTOM_EVENT_TYPE = "Custom/Lainnya";

const BUILT_IN_EVENT_TYPES = Array.from(GOOGLE_EVENT_TYPES);
const BUILT_IN_EVENT_TYPE_SET = new Set<string>(BUILT_IN_EVENT_TYPES);

function cleanEventTypeName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeEventTypeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const result: string[] = [];

  value.forEach((item) => {
    const normalized = cleanEventTypeName(item);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });

  return result;
}

export function getBuiltInEventTypes(): string[] {
  return [...BUILT_IN_EVENT_TYPES];
}

export function getAllEventTypes(customEventTypes: unknown): string[] {
  const normalizedCustom = normalizeEventTypeList(customEventTypes);
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
  const allEventTypes = getAllEventTypes(customEventTypes);
  const normalizedActive = normalizeEventTypeList(activeEventTypes);
  const activeOrder =
    normalizedActive.length > 0
      ? normalizedActive.filter((item) => allEventTypes.includes(item))
      : [...allEventTypes];
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
