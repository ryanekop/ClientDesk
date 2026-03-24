import { NextRequest, NextResponse } from "next/server";

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
  const page = parsePositiveInt(searchParams.get("page"), DEFAULT_PAGE);
  const perPage = Math.min(
    parsePositiveInt(searchParams.get("perPage"), DEFAULT_PER_PAGE),
    MAX_PER_PAGE,
  );
  const searchQuery = searchParams.get("search")?.trim() || "";
  const tagFilter = searchParams.get("tag")?.trim() || "All";
  const start = (page - 1) * perPage;
  const end = start + perPage - 1;

  let listQuery = supabase
    .from("freelance")
    .select(
      "id, name, role, whatsapp_number, google_email, status, tags, created_at",
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

  if (tagFilter && tagFilter !== "All") {
    listQuery = listQuery.contains("tags", [tagFilter]);
  }

  const [listResult, tagsResult, profileResult] = await Promise.all([
    listQuery.range(start, end),
    supabase.from("freelance").select("tags").eq("user_id", user.id),
    supabase
      .from("profiles")
      .select("table_column_preferences")
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

  const teamPreferences =
    (
      profileResult.data as {
        table_column_preferences?: { team?: unknown } | null;
      } | null
    )?.table_column_preferences?.team || null;

  return NextResponse.json({
    items: (listResult.data || []).map((member) => ({
      ...member,
      tags: Array.isArray(member.tags)
        ? member.tags.filter((tag): tag is string => typeof tag === "string")
        : [],
    })),
    totalItems: listResult.count || 0,
    metadata: {
      tags: tagOptions,
      tableColumnPreferences: teamPreferences,
    },
  });
}
