import { NextRequest, NextResponse } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";
import {
  cleanUniversityName,
  escapePostgresLikePattern,
  normalizeUniversityName,
} from "@/lib/university-references";

type UniversitySearchRow = {
  id: string;
  name: string;
  normalized_name: string;
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
    .select("id, name, normalized_name")
    .ilike("normalized_name", `%${escapePostgresLikePattern(normalizedQuery)}%`)
    .order("name", { ascending: true })
    .limit(Math.max(limit * 4, 20));

  if (error) {
    return NextResponse.json(
      { error: error.message || "Gagal mencari universitas.", items: [] },
      { status: 500 },
    );
  }

  const ranked = ((data || []) as UniversitySearchRow[])
    .sort((left, right) => {
      const leftPrefix = left.normalized_name.startsWith(normalizedQuery) ? 0 : 1;
      const rightPrefix = right.normalized_name.startsWith(normalizedQuery) ? 0 : 1;
      if (leftPrefix !== rightPrefix) return leftPrefix - rightPrefix;
      return left.name.localeCompare(right.name, "id");
    })
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      name: item.name,
    }));

  return NextResponse.json({ items: ranked });
}
