import { NextRequest, NextResponse } from "next/server";

import {
  isShowAllPackagesEventType,
  normalizeEventTypeList,
  normalizeEventTypeName,
} from "@/lib/event-type-config";
import { requireRouteUser } from "@/lib/pagination/route-user";

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 10;

type ServiceSearchRow = {
  id: string;
  name: string;
  is_addon?: boolean | null;
  event_types?: string[] | null;
  sort_order?: number | null;
};

function parseLimit(value: string | null) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(parsed, MAX_LIMIT));
}

function escapePostgrestLike(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_")
    .replaceAll(",", "\\,");
}

function getSearchRank(name: string, query: string) {
  if (name.startsWith(query)) return 0;
  if (name.includes(query)) return 1;
  return 2;
}

function isAvailableForEvent(
  eventTypes: string[] | null | undefined,
  normalizedEventType: string,
) {
  const normalized = normalizeEventTypeList(eventTypes);
  if (normalized.length === 0) return true;
  return normalized.some(
    (eventType) => normalizeEventTypeName(eventType) === normalizedEventType,
  );
}

export async function GET(request: NextRequest) {
  const { errorResponse, supabase, user } = await requireRouteUser();
  if (errorResponse || !user) {
    return errorResponse;
  }

  const searchParams = request.nextUrl.searchParams;
  const query = (searchParams.get("q") || "").trim();
  if (query.length < 2) {
    return NextResponse.json({ items: [] });
  }

  const group = searchParams.get("group") === "addon" ? "addon" : "main";
  const limit = parseLimit(searchParams.get("limit"));
  const eventTypeRaw = (searchParams.get("eventType") || "").trim();
  const normalizedEventType = normalizeEventTypeName(eventTypeRaw);
  const shouldFilterByEvent =
    Boolean(normalizedEventType) && !isShowAllPackagesEventType(normalizedEventType);

  const escapedQuery = escapePostgrestLike(query);
  const { data, error } = await supabase
    .from("services")
    .select("id, name, is_addon, event_types, sort_order")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .eq("is_public", true)
    .eq("is_addon", group === "addon")
    .ilike("name", `%${escapedQuery}%`)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .limit(Math.max(limit * 4, 24));

  if (error) {
    return NextResponse.json(
      { error: error.message || "Gagal mencari layanan.", items: [] },
      { status: 500 },
    );
  }

  const normalizedQuery = query.toLowerCase();
  const items = ((data || []) as ServiceSearchRow[])
    .filter(
      (item) =>
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        (!shouldFilterByEvent ||
          isAvailableForEvent(item.event_types, normalizedEventType || "")),
    )
    .sort((left, right) => {
      const leftRank = getSearchRank(left.name.toLowerCase(), normalizedQuery);
      const rightRank = getSearchRank(right.name.toLowerCase(), normalizedQuery);
      if (leftRank !== rightRank) return leftRank - rightRank;
      const leftSort =
        typeof left.sort_order === "number" ? left.sort_order : Number.MAX_SAFE_INTEGER;
      const rightSort =
        typeof right.sort_order === "number" ? right.sort_order : Number.MAX_SAFE_INTEGER;
      if (leftSort !== rightSort) return leftSort - rightSort;
      return left.name.localeCompare(right.name, "id");
    })
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      name: item.name,
      is_addon: Boolean(item.is_addon),
      event_types: normalizeEventTypeList(item.event_types),
    }));

  return NextResponse.json({ items });
}

