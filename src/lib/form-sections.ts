import {
  createDefaultFormLayout,
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

function buildModeAwareLayoutValue(
  eventType: string,
  value: unknown,
): FormLayoutItem[] | FormLayoutByMode {
  if (!isSplitCapableEventType(eventType)) {
    return normalizeStoredFormLayout(value, eventType, { layoutMode: "normal" });
  }

  if (isModeAwareFormSectionValue(value)) {
    const normalizedNormal =
      "normal" in value
        ? normalizeStoredFormLayout(value.normal, eventType, {
            layoutMode: "normal",
          })
        : createDefaultFormLayout(eventType, { layoutMode: "normal" });
    const normalizedSplit =
      "split" in value
        ? normalizeStoredFormLayout(value.split, eventType, {
            layoutMode: "split",
          })
        : createDefaultFormLayout(eventType, { layoutMode: "split" });

    return {
      normal: normalizedNormal,
      split: normalizedSplit,
    };
  }

  return {
    normal: normalizeStoredFormLayout(value, eventType, {
      layoutMode: "normal",
    }),
    split: createDefaultFormLayout(eventType, { layoutMode: "split" }),
  };
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

        acc[normalizedKey] = buildModeAwareLayoutValue(normalizedKey, value);
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
