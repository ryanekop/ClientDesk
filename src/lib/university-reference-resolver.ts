import { createServiceClient } from "@/lib/supabase/service";
import {
  cleanUniversityName,
  matchesUniversityDisplayValue,
  normalizeUniversityAbbreviation,
  normalizeUniversityName,
} from "@/lib/university-references";

export type UniversityReferenceLookupRow = {
  id: string;
  name: string;
  abbreviation: string | null;
  normalized_name: string;
  normalized_abbreviation: string | null;
};

export type UniversityLookupMaps = {
  byNormalizedName: Map<string, UniversityReferenceLookupRow>;
  byNormalizedAbbreviation: Map<string, UniversityReferenceLookupRow>;
};

export type UniversitySelectionResolution =
  | {
      status: "id-hit" | "name-hit";
      reference: UniversityReferenceLookupRow;
    }
  | {
      status:
        | "missing-input"
        | "missing-reference"
        | "not-found"
        | "ambiguous"
        | "mismatch";
      reference: null;
    };

const UNIVERSITY_REFERENCE_SELECT =
  "id, name, abbreviation, normalized_name, normalized_abbreviation";

export function isUniversityReferenceUuid(value: string | null | undefined) {
  const candidate = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    candidate,
  );
}

export function buildUniversityLookupCandidates(submittedValue: string) {
  const cleaned = cleanUniversityName(submittedValue);
  const normalizedNameCandidates = new Set<string>();
  const normalizedAbbreviationCandidates = new Set<string>();
  if (!cleaned) {
    return {
      cleaned,
      normalizedNameCandidates,
      normalizedAbbreviationCandidates,
    };
  }

  normalizedNameCandidates.add(normalizeUniversityName(cleaned));

  const displayMatch = cleaned.match(/^(.*)\(([^()]+)\)\s*$/);
  if (displayMatch) {
    const parsedName = cleanUniversityName(displayMatch[1] || "");
    const parsedAbbreviation = normalizeUniversityAbbreviation(
      displayMatch[2] || "",
    );

    if (parsedName) {
      normalizedNameCandidates.add(normalizeUniversityName(parsedName));
    }
    if (parsedAbbreviation) {
      normalizedAbbreviationCandidates.add(parsedAbbreviation);
    }
  }

  const normalizedAbbreviation = normalizeUniversityAbbreviation(cleaned);
  if (normalizedAbbreviation && normalizedAbbreviation.length <= 24) {
    normalizedAbbreviationCandidates.add(normalizedAbbreviation);
  }

  return {
    cleaned,
    normalizedNameCandidates,
    normalizedAbbreviationCandidates,
  };
}

export function getUniversityLookupRows(
  map: Map<string, UniversityReferenceLookupRow>,
  token: string,
) {
  const value = token.trim();
  if (!value) return [] as UniversityReferenceLookupRow[];
  const row = map.get(value);
  return row ? [row] : [];
}

export function resolveUniversityReferenceMatches(params: {
  submittedValue: string;
  byNormalizedName: Map<string, UniversityReferenceLookupRow>;
  byNormalizedAbbreviation: Map<string, UniversityReferenceLookupRow>;
}) {
  const submitted = cleanUniversityName(params.submittedValue);
  const candidates = buildUniversityLookupCandidates(submitted);
  const matchedRows = new Map<string, UniversityReferenceLookupRow>();

  candidates.normalizedNameCandidates.forEach((token) => {
    getUniversityLookupRows(params.byNormalizedName, token).forEach((item) => {
      matchedRows.set(item.id, item);
    });
  });
  candidates.normalizedAbbreviationCandidates.forEach((token) => {
    getUniversityLookupRows(params.byNormalizedAbbreviation, token).forEach((item) => {
      matchedRows.set(item.id, item);
    });
  });

  const normalizedSubmittedAbbreviation = normalizeUniversityAbbreviation(submitted);
  return Array.from(matchedRows.values()).filter((item) => {
    if (
      normalizedSubmittedAbbreviation &&
      item.normalized_abbreviation === normalizedSubmittedAbbreviation
    ) {
      return true;
    }
    return matchesUniversityDisplayValue({
      submittedValue: submitted,
      name: item.name,
      abbreviation: item.abbreviation,
    });
  });
}

export async function fetchUniversityReferencesByIds(ids: Iterable<string>) {
  const uniqueIds = Array.from(
    new Set(
      Array.from(ids)
        .map((item) => String(item || "").trim())
        .filter((item) => item.length > 0 && isUniversityReferenceUuid(item)),
    ),
  );
  const byReferenceId = new Map<string, UniversityReferenceLookupRow>();
  if (uniqueIds.length === 0) return byReferenceId;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("university_references")
    .select(UNIVERSITY_REFERENCE_SELECT)
    .in("id", uniqueIds);

  if (error) throw error;

  for (const row of (data || []) as UniversityReferenceLookupRow[]) {
    byReferenceId.set(row.id, row);
  }
  return byReferenceId;
}

export async function fetchUniversityReferenceLookupMaps(params: {
  normalizedNames: Iterable<string>;
  normalizedAbbreviations: Iterable<string>;
}) {
  const normalizedNames = Array.from(
    new Set(
      Array.from(params.normalizedNames)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
  const normalizedAbbreviations = Array.from(
    new Set(
      Array.from(params.normalizedAbbreviations)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );

  const byNormalizedName = new Map<string, UniversityReferenceLookupRow>();
  const byNormalizedAbbreviation = new Map<string, UniversityReferenceLookupRow>();
  if (normalizedNames.length === 0 && normalizedAbbreviations.length === 0) {
    return { byNormalizedName, byNormalizedAbbreviation } satisfies UniversityLookupMaps;
  }

  const supabase = createServiceClient();

  if (normalizedNames.length > 0) {
    const { data, error } = await supabase
      .from("university_references")
      .select(UNIVERSITY_REFERENCE_SELECT)
      .in("normalized_name", normalizedNames);

    if (error) throw error;

    for (const row of (data || []) as UniversityReferenceLookupRow[]) {
      if (!row.normalized_name) continue;
      byNormalizedName.set(row.normalized_name, row);
    }
  }

  if (normalizedAbbreviations.length > 0) {
    const { data, error } = await supabase
      .from("university_references")
      .select(UNIVERSITY_REFERENCE_SELECT)
      .in("normalized_abbreviation", normalizedAbbreviations);

    if (error) throw error;

    for (const row of (data || []) as UniversityReferenceLookupRow[]) {
      if (!row.normalized_abbreviation) continue;
      if (!byNormalizedAbbreviation.has(row.normalized_abbreviation)) {
        byNormalizedAbbreviation.set(row.normalized_abbreviation, row);
      } else {
        byNormalizedAbbreviation.delete(row.normalized_abbreviation);
      }
    }
  }

  return { byNormalizedName, byNormalizedAbbreviation } satisfies UniversityLookupMaps;
}

export async function resolveUniversityReferenceSelection(params: {
  submittedValue: string;
  submittedReferenceId?: string | null;
}): Promise<UniversitySelectionResolution> {
  const submittedValue = cleanUniversityName(params.submittedValue);
  const submittedReferenceId = String(params.submittedReferenceId || "").trim();

  if (!submittedValue && !submittedReferenceId) {
    return { status: "missing-input", reference: null };
  }

  if (submittedReferenceId && isUniversityReferenceUuid(submittedReferenceId)) {
    const byReferenceId = await fetchUniversityReferencesByIds([submittedReferenceId]);
    const foundById = byReferenceId.get(submittedReferenceId) || null;
    if (
      foundById &&
      (!submittedValue ||
        matchesUniversityDisplayValue({
          submittedValue,
          name: foundById.name,
          abbreviation: foundById.abbreviation,
        }))
    ) {
      return { status: "id-hit", reference: foundById };
    }
  }

  if (!submittedValue) {
    return {
      status: submittedReferenceId ? "mismatch" : "missing-reference",
      reference: null,
    };
  }

  const candidates = buildUniversityLookupCandidates(submittedValue);
  const lookupMaps = await fetchUniversityReferenceLookupMaps({
    normalizedNames: candidates.normalizedNameCandidates,
    normalizedAbbreviations: candidates.normalizedAbbreviationCandidates,
  });
  const resolvedRows = resolveUniversityReferenceMatches({
    submittedValue,
    ...lookupMaps,
  });

  if (resolvedRows.length === 1) {
    return { status: "name-hit", reference: resolvedRows[0] };
  }
  if (resolvedRows.length > 1) {
    return { status: "ambiguous", reference: null };
  }

  return {
    status: submittedReferenceId ? "mismatch" : "not-found",
    reference: null,
  };
}
