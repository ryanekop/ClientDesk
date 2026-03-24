import { NextRequest, NextResponse } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";
import {
  buildUniversityDisplayName,
  cleanUniversityName,
  escapePostgresLikePattern,
  normalizeUniversityAbbreviation,
  normalizeUniversityName,
} from "@/lib/university-references";

type UniversitySearchRow = {
  id: string;
  name: string;
  abbreviation?: string | null;
  normalized_name: string;
  normalized_abbreviation?: string | null;
};

function parseLimit(value: string | null) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return 8;
  return Math.max(1, Math.min(parsed, 10));
}

export async function GET(request: NextRequest) {
  const rawQuery = request.nextUrl.searchParams.get("q");
  const query = cleanUniversityName(rawQuery || "");

  if (query.length < 2) {
    return NextResponse.json({ items: [] });
  }

  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
  const normalizedQuery = normalizeUniversityName(query);
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("university_references")
    .select("id, name, abbreviation, normalized_name, normalized_abbreviation")
    .or(
      [
        `normalized_name.ilike.%${escapePostgresLikePattern(normalizedQuery)}%`,
        `normalized_abbreviation.ilike.%${escapePostgresLikePattern(
          normalizeUniversityAbbreviation(query),
        )}%`,
      ].join(","),
    )
    .order("name", { ascending: true })
    .limit(Math.max(limit * 6, 30));

  if (error) {
    return NextResponse.json(
      { error: error.message || "Gagal mencari universitas.", items: [] },
      { status: 500 },
    );
  }

  const ranked = ((data || []) as UniversitySearchRow[])
    .sort((left, right) => {
      const leftRank = getSearchRank(left, normalizedQuery);
      const rightRank = getSearchRank(right, normalizedQuery);
      if (leftRank !== rightRank) return leftRank - rightRank;
      return buildUniversityDisplayName(
        left.name,
        left.abbreviation,
      ).localeCompare(buildUniversityDisplayName(right.name, right.abbreviation), "id");
    })
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      name: item.name,
      abbreviation: item.abbreviation || null,
      displayName: buildUniversityDisplayName(item.name, item.abbreviation),
    }));

  return NextResponse.json({ items: ranked });
}

function getSearchRank(
  item: UniversitySearchRow,
  normalizedQuery: string,
) {
  const abbreviation = item.normalized_abbreviation || "";
  if (item.normalized_name.startsWith(normalizedQuery)) return 0;
  if (abbreviation && abbreviation.startsWith(normalizedQuery)) return 1;
  if (item.normalized_name.includes(normalizedQuery)) return 2;
  if (abbreviation && abbreviation.includes(normalizedQuery)) return 3;
  return 4;
}
