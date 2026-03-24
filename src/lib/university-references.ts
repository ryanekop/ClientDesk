import { normalizeEventTypeName } from "@/lib/event-type-config";

export const UNIVERSITY_EXTRA_FIELD_KEY = "universitas";
export const UNIVERSITY_REFERENCE_EXTRA_KEY = "universitas_ref_id";

export type UniversityReferenceSource = "kip_kuliah" | "manual";

export type UniversityReferenceItem = {
  id: string;
  name: string;
};

export function cleanUniversityName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeUniversityName(value: string) {
  return cleanUniversityName(value).toLowerCase();
}

export function isUniversityExtraField(params: {
  eventType: string | null | undefined;
  fieldKey: string | null | undefined;
}) {
  return (
    normalizeEventTypeName(params.eventType) === "Wisuda" &&
    params.fieldKey === UNIVERSITY_EXTRA_FIELD_KEY
  );
}

export function getUniversityReferenceId(
  raw: Record<string, unknown> | null | undefined,
) {
  const value = raw?.[UNIVERSITY_REFERENCE_EXTRA_KEY];
  if (typeof value !== "string") return "";
  return value.trim();
}

export function hasUniversityReferenceSelection(
  extraFields: Record<string, string> | null | undefined,
  eventType: string | null | undefined,
) {
  if (normalizeEventTypeName(eventType) !== "Wisuda") {
    return true;
  }

  const universityName = cleanUniversityName(
    extraFields?.[UNIVERSITY_EXTRA_FIELD_KEY] || "",
  );
  const universityRefId = (extraFields?.[UNIVERSITY_REFERENCE_EXTRA_KEY] || "").trim();

  return universityName.length > 0 && universityRefId.length > 0;
}

export function isUniversityReferenceMetaKey(key: string) {
  return key === UNIVERSITY_REFERENCE_EXTRA_KEY;
}

export function escapePostgresLikePattern(value: string) {
  return value.replace(/[%_\\]/g, "\\$&");
}
