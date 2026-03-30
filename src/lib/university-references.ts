import { normalizeEventTypeName } from "@/lib/event-type-config";

export const UNIVERSITY_EXTRA_FIELD_KEY = "universitas";
export const UNIVERSITY_REFERENCE_EXTRA_KEY = "universitas_ref_id";
export const UNIVERSITY_ABBREVIATION_DRAFT_EXTRA_KEY =
  "universitas_abbreviation_draft";
export const UNIVERSITY_EVENT_TYPE = "Wisuda";

export type UniversityReferenceSource =
  | "kip_kuliah"
  | "wikipedia_kedinasan"
  | "wikipedia_poltekkes"
  | "wikipedia_ptn"
  | "wikipedia_ptkn"
  | "manual";

export type UniversityReferenceItem = {
  id: string;
  name: string;
  abbreviation?: string | null;
  displayName?: string;
};

export function cleanUniversityName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeUniversityName(value: string) {
  return cleanUniversityName(value).toLowerCase();
}

export function cleanUniversityAbbreviation(value: string | null | undefined) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function normalizeUniversityAbbreviation(
  value: string | null | undefined,
) {
  return cleanUniversityAbbreviation(value).toLowerCase();
}

export function buildUniversityDisplayName(
  name: string,
  abbreviation?: string | null,
) {
  const cleanedName = cleanUniversityName(name);
  const cleanedAbbreviation = cleanUniversityAbbreviation(abbreviation);
  if (!cleanedName) return "";
  if (!cleanedAbbreviation) return cleanedName;
  return `${cleanedName} (${cleanedAbbreviation})`;
}

export function matchesUniversityDisplayValue(params: {
  submittedValue: string;
  name: string;
  abbreviation?: string | null;
}) {
  const normalizedSubmitted = normalizeUniversityName(params.submittedValue);
  if (!normalizedSubmitted) return false;

  return (
    normalizedSubmitted === normalizeUniversityName(params.name) ||
    normalizedSubmitted ===
      normalizeUniversityName(
        buildUniversityDisplayName(params.name, params.abbreviation),
      )
  );
}

export function isUniversityExtraField(params: {
  eventType: string | null | undefined;
  fieldKey: string | null | undefined;
}) {
  return (
    params.fieldKey === UNIVERSITY_EXTRA_FIELD_KEY &&
    isUniversityEventType(params.eventType)
  );
}

export function isUniversityEventType(
  eventType: string | null | undefined,
) {
  return (normalizeEventTypeName(eventType) || "") === UNIVERSITY_EVENT_TYPE;
}

export function getUniversityReferenceId(
  raw: Record<string, unknown> | null | undefined,
) {
  const value = raw?.[UNIVERSITY_REFERENCE_EXTRA_KEY];
  if (typeof value !== "string") return "";
  return value.trim();
}

export function getUniversityDraftAbbreviation(
  raw: Record<string, unknown> | null | undefined,
) {
  const value = raw?.[UNIVERSITY_ABBREVIATION_DRAFT_EXTRA_KEY];
  if (typeof value !== "string") return "";
  return cleanUniversityAbbreviation(value);
}

export function hasUniversityValue(
  extraFields: Record<string, string> | null | undefined,
) {
  const universityName = cleanUniversityName(
    extraFields?.[UNIVERSITY_EXTRA_FIELD_KEY] || "",
  );
  return universityName.length > 0;
}

export function isUniversityReferenceItem(
  value: unknown,
): value is UniversityReferenceItem {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof (value as UniversityReferenceItem).id === "string" &&
    typeof (value as UniversityReferenceItem).name === "string"
  );
}

export function isUniversityReferenceMetaKey(key: string) {
  return key === UNIVERSITY_REFERENCE_EXTRA_KEY;
}

export function escapePostgresLikePattern(value: string) {
  return value.replace(/[%_\\]/g, "\\$&");
}
