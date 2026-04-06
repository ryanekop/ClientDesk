import {
  normalizeStoredFormLayout,
  resolveNormalizedActiveFormLayout,
  type FormLayoutItem,
} from "@/components/form-builder/booking-form-layout";
import { normalizeEventTypeName } from "@/lib/event-type-config";

export type FormSectionsByEventType = Record<string, FormLayoutItem[]>;

export function normalizeFormSectionsByEventType(
  rawFormSections: unknown,
): FormSectionsByEventType {
  if (Array.isArray(rawFormSections)) {
    return { Umum: normalizeStoredFormLayout(rawFormSections, "Umum") };
  }

  if (rawFormSections && typeof rawFormSections === "object") {
    return Object.entries(rawFormSections as Record<string, unknown>).reduce(
      (acc, [key, value]) => {
        const normalizedKey = normalizeEventTypeName(key) || key;
        if (!(normalizedKey in acc) || key === normalizedKey) {
          acc[normalizedKey] = normalizeStoredFormLayout(value, normalizedKey);
        }
        return acc;
      },
      {} as FormSectionsByEventType,
    );
  }

  return {};
}

export function resolveNormalizedLayoutFromStoredSections(
  rawFormSections: unknown,
  eventType: string | null | undefined,
) {
  return resolveNormalizedActiveFormLayout(
    normalizeFormSectionsByEventType(rawFormSections),
    eventType,
  );
}

export function hasBuiltInFieldInStoredSections(
  rawFormSections: unknown,
  eventType: string | null | undefined,
  builtinId: string,
) {
  return resolveNormalizedLayoutFromStoredSections(rawFormSections, eventType).some(
    (item) =>
      item.kind === "builtin_field" &&
      item.hidden !== true &&
      item.builtinId === builtinId,
  );
}
