import {
  normalizeStoredFormLayout,
  type FormLayoutByMode,
  type FormLayoutItem,
  type FormLayoutMode,
} from "@/components/form-builder/booking-form-layout";
import { normalizeEventTypeName } from "@/lib/event-type-config";

export type FormSectionsByEventType = Record<string, FormLayoutItem[]>;
export type ModeAwareFormSectionValue = FormLayoutItem[] | FormLayoutByMode;
export type ModeAwareFormSectionsByEventType = Record<
  string,
  ModeAwareFormSectionValue
>;

type ResolveLayoutOptions = {
  layoutMode?: FormLayoutMode;
};

function isSplitCapableEventType(eventType: string | null | undefined) {
  return eventType === "Wedding" || eventType === "Wisuda";
}

function resolveLayoutModeForEvent(
  eventType: string | null | undefined,
  layoutMode?: FormLayoutMode,
): FormLayoutMode {
  if (!isSplitCapableEventType(eventType)) return "normal";
  return layoutMode === "split" ? "split" : "normal";
}

function isModeAwareFormSectionValue(value: unknown): value is FormLayoutByMode {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return "normal" in record || "split" in record;
}

export function normalizeModeAwareFormSectionsByEventType(
  rawFormSections: unknown,
): ModeAwareFormSectionsByEventType {
  if (Array.isArray(rawFormSections)) {
    return { Umum: normalizeStoredFormLayout(rawFormSections, "Umum") };
  }

  if (rawFormSections && typeof rawFormSections === "object") {
    return Object.entries(rawFormSections as Record<string, unknown>).reduce(
      (acc, [key, value]) => {
        const normalizedKey = normalizeEventTypeName(key) || key;
        if (normalizedKey in acc && key !== normalizedKey) {
          return acc;
        }

        if (isModeAwareFormSectionValue(value)) {
          const normalizedModeValue: FormLayoutByMode = {};
          if ("normal" in value) {
            normalizedModeValue.normal = normalizeStoredFormLayout(
              value.normal,
              normalizedKey,
              { layoutMode: "normal" },
            );
          }
          if ("split" in value) {
            normalizedModeValue.split = normalizeStoredFormLayout(
              value.split,
              normalizedKey,
              { layoutMode: "split" },
            );
          }
          acc[normalizedKey] = normalizedModeValue;
          return acc;
        }

        acc[normalizedKey] = normalizeStoredFormLayout(value, normalizedKey);
        return acc;
      },
      {} as ModeAwareFormSectionsByEventType,
    );
  }

  return {};
}

export function normalizeFormSectionsByEventType(
  rawFormSections: unknown,
): FormSectionsByEventType {
  const normalizedModeAwareSections =
    normalizeModeAwareFormSectionsByEventType(rawFormSections);
  return Object.fromEntries(
    Object.entries(normalizedModeAwareSections).map(([eventType, value]) => {
      if (Array.isArray(value)) {
        return [eventType, normalizeStoredFormLayout(value, eventType)] as const;
      }
      const fallbackRaw = value.normal ?? value.split ?? [];
      return [
        eventType,
        normalizeStoredFormLayout(fallbackRaw, eventType, {
          layoutMode: "normal",
        }),
      ] as const;
    }),
  ) as FormSectionsByEventType;
}

export function resolveNormalizedLayoutFromStoredSections(
  rawFormSections: unknown,
  eventType: string | null | undefined,
  options: ResolveLayoutOptions = {},
) {
  const normalizedEventType = normalizeEventTypeName(eventType) || eventType || "Umum";
  const normalizedSections =
    normalizeModeAwareFormSectionsByEventType(rawFormSections);
  const candidateValue =
    normalizedSections[normalizedEventType] || normalizedSections.Umum || [];
  const resolvedLayoutMode = resolveLayoutModeForEvent(
    normalizedEventType,
    options.layoutMode,
  );

  if (Array.isArray(candidateValue)) {
    return normalizeStoredFormLayout(candidateValue, normalizedEventType, {
      layoutMode: resolvedLayoutMode,
    });
  }

  const modeRaw =
    resolvedLayoutMode === "split"
      ? candidateValue.split
      : candidateValue.normal ?? candidateValue.split ?? [];
  return normalizeStoredFormLayout(modeRaw, normalizedEventType, {
    layoutMode: resolvedLayoutMode,
  });
}

export function hasBuiltInFieldInStoredSections(
  rawFormSections: unknown,
  eventType: string | null | undefined,
  builtinId: string,
  options: ResolveLayoutOptions = {},
) {
  return resolveNormalizedLayoutFromStoredSections(
    rawFormSections,
    eventType,
    options,
  ).some(
    (item) =>
      item.kind === "builtin_field" &&
      item.hidden !== true &&
      item.builtinId === builtinId,
  );
}
