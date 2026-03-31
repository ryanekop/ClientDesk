import { NextRequest, NextResponse } from "next/server";

import {
  getActiveEventTypes,
  isShowAllPackagesEventType,
  normalizeEventTypeList,
  normalizeEventTypeName,
} from "@/lib/event-type-config";
import { requireRouteUser } from "@/lib/pagination/route-user";

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 10;
const MAX_PER_PAGE = 100;

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
}

function escapePostgrestLike(value: string) {
  return value.replaceAll("%", "\\%").replaceAll(",", "\\,");
}

export async function GET(request: NextRequest) {
  const { errorResponse, supabase, user } = await requireRouteUser();
  if (errorResponse || !user) {
    return errorResponse;
  }

  const searchParams = request.nextUrl.searchParams;
  const group = searchParams.get("group") === "addon" ? "addon" : "main";
  const page = parsePositiveInt(searchParams.get("page"), DEFAULT_PAGE);
  const perPage = Math.min(
    parsePositiveInt(searchParams.get("perPage"), DEFAULT_PER_PAGE),
    MAX_PER_PAGE,
  );
  const searchQuery = searchParams.get("search")?.trim() || "";
  const selectedEventFilter = searchParams.get("eventType")?.trim() || "";
  const normalizedEventFilter = normalizeEventTypeName(selectedEventFilter);
  const start = (page - 1) * perPage;
  const end = start + perPage - 1;

  let listQuery = supabase
    .from("services")
    .select(
      "id, name, description, price, original_price, duration_minutes, is_active, is_addon, affects_schedule, is_public, sort_order, created_at, event_types, color",
      { count: "exact" },
    )
    .eq("user_id", user.id)
    .eq("is_addon", group === "addon")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (searchQuery) {
    const escaped = escapePostgrestLike(searchQuery);
    listQuery = listQuery.or(
      `name.ilike.%${escaped}%,description.ilike.%${escaped}%`,
    );
  }

  if (normalizedEventFilter && !isShowAllPackagesEventType(normalizedEventFilter)) {
    listQuery = listQuery.contains("event_types", [normalizedEventFilter]);
  }

  const [listResult, profileResult, countResult, usedEventTypesResult] =
    await Promise.all([
      listQuery.range(start, end),
      supabase
        .from("profiles")
        .select("form_event_types, custom_event_types")
        .eq("id", user.id)
        .single(),
      supabase
        .from("services")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("services")
        .select("event_types")
        .eq("user_id", user.id),
    ]);

  if (listResult.error) {
    return NextResponse.json(
      { error: listResult.error.message },
      { status: 500 },
    );
  }

  if (profileResult.error) {
    return NextResponse.json(
      { error: profileResult.error.message },
      { status: 500 },
    );
  }

  if (countResult.error) {
    return NextResponse.json(
      { error: countResult.error.message },
      { status: 500 },
    );
  }

  if (usedEventTypesResult.error) {
    return NextResponse.json(
      { error: usedEventTypesResult.error.message },
      { status: 500 },
    );
  }

  const activeEventTypes = getActiveEventTypes({
    customEventTypes: normalizeEventTypeList(
      profileResult.data?.custom_event_types,
    ),
    activeEventTypes: profileResult.data?.form_event_types,
  });

  const usedEventTypes = Array.from(
    new Set(
      (usedEventTypesResult.data || []).flatMap((row) =>
        Array.isArray(row.event_types)
          ? row.event_types
              .map((eventType) => normalizeEventTypeName(eventType))
              .filter((eventType): eventType is string => Boolean(eventType))
          : [],
      ),
    ),
  ).sort((left, right) => left.localeCompare(right));

  return NextResponse.json({
    items: listResult.data || [],
    totalItems: listResult.count || 0,
    metadata: {
      eventTypeOptions: activeEventTypes,
      usedEventTypes,
      hasAnyServices: (countResult.count || 0) > 0,
    },
  });
}
