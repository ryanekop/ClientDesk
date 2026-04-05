import { NextRequest, NextResponse } from "next/server";

import { requireRouteUser } from "@/lib/pagination/route-user";

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 10;
const MAX_PER_PAGE = 100;
const HEX_COLOR_6 = /^#([0-9a-f]{6})$/i;
const HEX_COLOR_3 = /^#([0-9a-f]{3})$/i;

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

function parseStringListValue(rawValue: string) {
  const trimmed = rawValue.trim();
  if (!trimmed) return [] as string[];

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    // Fallback to CSV parsing.
  }

  return trimmed.split(",");
}

function parseFilterList(
  searchParams: URLSearchParams,
  listKey: string,
  singleKey: string,
) {
  const seen = new Set<string>();
  const normalized: string[] = [];
  const listValues = searchParams.getAll(listKey);

  listValues.forEach((rawValue) => {
    parseStringListValue(rawValue).forEach((candidate) => {
      const trimmed = candidate.trim();
      if (!trimmed || trimmed.toLowerCase() === "all" || seen.has(trimmed)) return;
      seen.add(trimmed);
      normalized.push(trimmed);
    });
  });

  if (normalized.length > 0) {
    return normalized;
  }

  const legacySingleValue = searchParams.get(singleKey)?.trim() || "";
  if (!legacySingleValue || legacySingleValue.toLowerCase() === "all") {
    return [] as string[];
  }

  return [legacySingleValue];
}

function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const prefixed = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  const shortMatch = prefixed.match(HEX_COLOR_3);
  if (shortMatch) {
    const [r, g, b] = shortMatch[1].toUpperCase().split("");
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  const longMatch = prefixed.match(HEX_COLOR_6);
  if (longMatch) {
    return `#${longMatch[1].toUpperCase()}`;
  }

  return null;
}

function normalizeBadgeColorRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, string>;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, color]) => [key.trim(), normalizeHexColor(color)] as const)
      .filter(
        (entry): entry is [string, string] =>
          entry[0].length > 0 && typeof entry[1] === "string",
      ),
  );
}

export async function GET(request: NextRequest) {
  const { errorResponse, supabase, user } = await requireRouteUser();
  if (errorResponse || !user) {
    return errorResponse;
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parsePositiveInt(searchParams.get("page"), DEFAULT_PAGE);
  const perPage = Math.min(
    parsePositiveInt(searchParams.get("perPage"), DEFAULT_PER_PAGE),
    MAX_PER_PAGE,
  );
  const searchQuery = searchParams.get("search")?.trim() || "";
  const statusFilters = parseFilterList(searchParams, "statusFilters", "status");
  const roleFilters = parseFilterList(searchParams, "roleFilters", "role");
  const tagFilters = parseFilterList(searchParams, "tagFilters", "tag");
  const start = (page - 1) * perPage;
  const end = start + perPage - 1;

  let listQuery = supabase
    .from("freelance")
    .select(
      "id, name, role, whatsapp_number, google_email, status, tags, pricelist, created_at",
      { count: "exact" },
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (searchQuery) {
    const escaped = escapePostgrestLike(searchQuery);
    listQuery = listQuery.or(
      `name.ilike.%${escaped}%,role.ilike.%${escaped}%`,
    );
  }

  if (statusFilters.length > 0) {
    listQuery = listQuery.in("status", statusFilters);
  }

  if (roleFilters.length > 0) {
    listQuery = listQuery.in("role", roleFilters);
  }

  if (tagFilters.length > 0) {
    listQuery = listQuery.overlaps("tags", tagFilters);
  }

  const [listResult, tagsResult, profileResult] = await Promise.all([
    listQuery.range(start, end),
    supabase.from("freelance").select("tags, role, status").eq("user_id", user.id),
    supabase
      .from("profiles")
      .select("table_column_preferences, team_badge_colors")
      .eq("id", user.id)
      .single(),
  ]);

  if (listResult.error) {
    return NextResponse.json(
      { error: listResult.error.message },
      { status: 500 },
    );
  }

  if (tagsResult.error) {
    return NextResponse.json(
      { error: tagsResult.error.message },
      { status: 500 },
    );
  }

  if (profileResult.error && profileResult.status !== 406) {
    return NextResponse.json(
      { error: profileResult.error.message },
      { status: 500 },
    );
  }

  const tagOptions = Array.from(
    new Set(
      (tagsResult.data || []).flatMap((row) =>
        Array.isArray(row.tags)
          ? row.tags.filter((tag): tag is string => typeof tag === "string")
          : [],
      ),
    ),
  ).sort((left, right) => left.localeCompare(right));
  const roleOptions = Array.from(
    new Set(
      (tagsResult.data || [])
        .map((row) => (typeof row.role === "string" ? row.role.trim() : ""))
        .filter((role): role is string => role.length > 0),
    ),
  ).sort((left, right) => left.localeCompare(right));
  const statusOptions = Array.from(
    new Set(
      (tagsResult.data || [])
        .map((row) => (typeof row.status === "string" ? row.status.trim() : ""))
        .filter((status): status is string => status.length > 0),
    ),
  ).sort((left, right) => {
    const order: Record<string, number> = { active: 0, inactive: 1 };
    const leftOrder = order[left] ?? 2;
    const rightOrder = order[right] ?? 2;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.localeCompare(right);
  });

  const teamPreferences =
    (
      profileResult.data as {
        table_column_preferences?: { team?: unknown } | null;
        team_badge_colors?: unknown;
      } | null
    )?.table_column_preferences?.team || null;
  const teamBadgeColorsRaw = (
    profileResult.data as {
      team_badge_colors?: unknown;
    } | null
  )?.team_badge_colors;
  const teamBadgeColors =
    teamBadgeColorsRaw &&
    typeof teamBadgeColorsRaw === "object" &&
    !Array.isArray(teamBadgeColorsRaw)
      ? (teamBadgeColorsRaw as {
          roles?: unknown;
          tags?: unknown;
        })
      : null;

  return NextResponse.json({
    items: (listResult.data || []).map((member) => ({
      ...member,
      tags: Array.isArray(member.tags)
        ? member.tags.filter((tag): tag is string => typeof tag === "string")
        : [],
      pricelist:
        member.pricelist && typeof member.pricelist === "object"
          ? member.pricelist
          : null,
    })),
    totalItems: listResult.count || 0,
    metadata: {
      tags: tagOptions,
      roles: roleOptions,
      statuses: statusOptions,
      tableColumnPreferences: teamPreferences,
      badgeColors: {
        roles: normalizeBadgeColorRecord(teamBadgeColors?.roles),
        tags: normalizeBadgeColorRecord(teamBadgeColors?.tags),
      },
    },
  });
}
