"use client";

import {
  buildUniversityDisplayName,
  cleanUniversityAbbreviation,
  cleanUniversityName,
  isUniversityReferenceItem,
  UNIVERSITY_ABBREVIATION_DRAFT_EXTRA_KEY,
  UNIVERSITY_EXTRA_FIELD_KEY,
  UNIVERSITY_REFERENCE_EXTRA_KEY,
} from "@/lib/university-references";

type UniversityResolveResponse = {
  item?: unknown;
};

export async function resolveUniversityExtraFieldsForClient(
  extraFields: Record<string, string>,
  options: { enabled: boolean },
) {
  const next = { ...extraFields };

  if (!options.enabled) {
    delete next[UNIVERSITY_EXTRA_FIELD_KEY];
    delete next[UNIVERSITY_REFERENCE_EXTRA_KEY];
    delete next[UNIVERSITY_ABBREVIATION_DRAFT_EXTRA_KEY];
    return next;
  }

  const submittedUniversityName = cleanUniversityName(
    next[UNIVERSITY_EXTRA_FIELD_KEY] || "",
  );
  const submittedUniversityReferenceId = (
    next[UNIVERSITY_REFERENCE_EXTRA_KEY] || ""
  ).trim();
  const submittedUniversityAbbreviation = cleanUniversityAbbreviation(
    next[UNIVERSITY_ABBREVIATION_DRAFT_EXTRA_KEY] || "",
  );

  if (!submittedUniversityName) {
    delete next[UNIVERSITY_EXTRA_FIELD_KEY];
    delete next[UNIVERSITY_REFERENCE_EXTRA_KEY];
    delete next[UNIVERSITY_ABBREVIATION_DRAFT_EXTRA_KEY];
    return next;
  }

  if (submittedUniversityReferenceId) {
    next[UNIVERSITY_EXTRA_FIELD_KEY] = submittedUniversityName;
    next[UNIVERSITY_REFERENCE_EXTRA_KEY] = submittedUniversityReferenceId;
    delete next[UNIVERSITY_ABBREVIATION_DRAFT_EXTRA_KEY];
    return next;
  }

  const response = await fetch(
    `/api/public/universities/search?q=${encodeURIComponent(
      submittedUniversityName,
    )}&exact=1`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    },
  );

  if (!response.ok) {
    throw new Error("Gagal memvalidasi universitas.");
  }

  const payload = (await response.json().catch(() => ({}))) as UniversityResolveResponse;
  if (isUniversityReferenceItem(payload.item)) {
    next[UNIVERSITY_EXTRA_FIELD_KEY] = buildUniversityDisplayName(
      payload.item.name,
      payload.item.abbreviation,
    );
    next[UNIVERSITY_REFERENCE_EXTRA_KEY] = payload.item.id;
    delete next[UNIVERSITY_ABBREVIATION_DRAFT_EXTRA_KEY];
    return next;
  }

  next[UNIVERSITY_EXTRA_FIELD_KEY] = submittedUniversityName;
  if (submittedUniversityAbbreviation) {
    next[UNIVERSITY_ABBREVIATION_DRAFT_EXTRA_KEY] =
      submittedUniversityAbbreviation;
  } else {
    delete next[UNIVERSITY_ABBREVIATION_DRAFT_EXTRA_KEY];
  }
  delete next[UNIVERSITY_REFERENCE_EXTRA_KEY];
  return next;
}
