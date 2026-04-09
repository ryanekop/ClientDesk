import { NextRequest, NextResponse } from "next/server";

import { requireRouteUser } from "@/lib/pagination/route-user";
import {
  buildCityDisplayName,
  normalizeCityCode,
  type CityReferenceItem,
} from "@/lib/city-references";

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 10;

function parseLimit(value: string | null) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(parsed, MAX_LIMIT));
}

function normalizeSearchToken(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getSearchRank(item: CityReferenceItem, query: string) {
  const city = normalizeSearchToken(item.city_name);
  const province = normalizeSearchToken(item.province_name);
  const display = normalizeSearchToken(buildCityDisplayName(item));
  const code = normalizeCityCode(item.city_code);

  if (city.startsWith(query) || display.startsWith(query) || code.startsWith(query)) {
    return 0;
  }
  if (city.includes(query) || display.includes(query) || province.includes(query) || code.includes(query)) {
    return 1;
  }
  return 2;
}

export async function GET(request: NextRequest) {
  const { errorResponse, supabase } = await requireRouteUser();
  if (errorResponse) {
    return errorResponse;
  }

  const searchParams = request.nextUrl.searchParams;
  const query = normalizeSearchToken(searchParams.get("q") || "");
  if (query.length < 2) {
    return NextResponse.json({ items: [] });
  }

  const limit = parseLimit(searchParams.get("limit"));
  const { data, error } = await supabase
    .from("region_city_references")
    .select("city_code, city_name, province_code, province_name")
    .order("province_code", { ascending: true })
    .order("city_name", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message || "Gagal memuat suggestion kota/kabupaten.", items: [] },
      { status: 500 },
    );
  }

  const items = ((data || []) as CityReferenceItem[])
    .map((item) => ({
      city_code: normalizeCityCode(item.city_code),
      city_name: item.city_name,
      province_code: item.province_code,
      province_name: item.province_name,
    }))
    .filter((item) => item.city_code)
    .filter((item) => {
      const city = normalizeSearchToken(item.city_name);
      const province = normalizeSearchToken(item.province_name);
      const display = normalizeSearchToken(buildCityDisplayName(item));
      return (
        city.includes(query) ||
        province.includes(query) ||
        display.includes(query) ||
        item.city_code.includes(query)
      );
    })
    .sort((left, right) => {
      const leftRank = getSearchRank(left, query);
      const rightRank = getSearchRank(right, query);
      if (leftRank !== rightRank) return leftRank - rightRank;
      if (left.province_name !== right.province_name) {
        return left.province_name.localeCompare(right.province_name, "id");
      }
      return left.city_name.localeCompare(right.city_name, "id");
    })
    .slice(0, limit)
    .map((item) => ({
      ...item,
      display_name: buildCityDisplayName(item),
    }));

  return NextResponse.json({ items });
}
