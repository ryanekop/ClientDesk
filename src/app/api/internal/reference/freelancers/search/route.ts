import { NextRequest, NextResponse } from "next/server";

import { requireRouteUser } from "@/lib/pagination/route-user";

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 10;

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

  const limit = parseLimit(searchParams.get("limit"));
  const status = (searchParams.get("status") || "active").trim().toLowerCase();
  const escapedQuery = escapePostgrestLike(query);

  let dbQuery = supabase
    .from("freelance")
    .select("id, name, status")
    .eq("user_id", user.id)
    .ilike("name", `%${escapedQuery}%`)
    .order("name", { ascending: true })
    .limit(Math.max(limit * 3, 24));

  if (status === "active") {
    dbQuery = dbQuery.eq("status", "active");
  } else if (status === "inactive") {
    dbQuery = dbQuery.eq("status", "inactive");
  }

  const { data, error } = await dbQuery;
  if (error) {
    return NextResponse.json(
      { error: error.message || "Gagal mencari freelance.", items: [] },
      { status: 500 },
    );
  }

  const items = ((data || []) as Array<{ id: string; name: string; status?: string | null }>)
    .filter((item) => typeof item.id === "string" && typeof item.name === "string")
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      name: item.name,
      status: item.status || null,
    }));

  return NextResponse.json({ items });
}

