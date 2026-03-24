import { NextRequest, NextResponse } from "next/server";

import { requireRouteUser } from "@/lib/pagination/route-user";
import { createServiceClient } from "@/lib/supabase/service";
import {
  cleanUniversityName,
  normalizeUniversityName,
} from "@/lib/university-references";

type UniversityRow = {
  id: string;
  name: string;
};

function isUniqueViolation(error: { code?: string | null } | null | undefined) {
  return error?.code === "23505";
}

export async function POST(request: NextRequest) {
  const { errorResponse } = await requireRouteUser();
  if (errorResponse) {
    return errorResponse;
  }

  const payload = await request.json().catch(() => null);
  const name = cleanUniversityName(
    payload && typeof payload === "object" && typeof payload.name === "string"
      ? payload.name
      : "",
  );

  if (name.length < 2) {
    return NextResponse.json(
      { success: false, error: "Nama universitas minimal 2 karakter." },
      { status: 400 },
    );
  }

  if (name.length > 160) {
    return NextResponse.json(
      { success: false, error: "Nama universitas terlalu panjang." },
      { status: 400 },
    );
  }

  const normalizedName = normalizeUniversityName(name);
  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("university_references")
    .select("id, name")
    .eq("normalized_name", normalizedName)
    .maybeSingle<UniversityRow>();

  if (existing) {
    return NextResponse.json({
      success: true,
      created: false,
      item: existing,
    });
  }

  const { data, error } = await supabase
    .from("university_references")
    .insert({
      name,
      normalized_name: normalizedName,
      source: "manual",
      last_seen_at: new Date().toISOString(),
    })
    .select("id, name")
    .single<UniversityRow>();

  if (error && isUniqueViolation(error)) {
    const { data: retryExisting } = await supabase
      .from("university_references")
      .select("id, name")
      .eq("normalized_name", normalizedName)
      .maybeSingle<UniversityRow>();

    if (retryExisting) {
      return NextResponse.json({
        success: true,
        created: false,
        item: retryExisting,
      });
    }
  }

  if (error || !data) {
    return NextResponse.json(
      { success: false, error: error?.message || "Gagal menambah universitas." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    created: true,
    item: data,
  });
}
