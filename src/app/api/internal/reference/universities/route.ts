import { NextRequest, NextResponse } from "next/server";

import { requireRouteUser } from "@/lib/pagination/route-user";
import { createServiceClient } from "@/lib/supabase/service";
import { apiText } from "@/lib/i18n/api-errors";
import {
  buildUniversityDisplayName,
  cleanUniversityName,
  normalizeUniversityName,
} from "@/lib/university-references";

type UniversityRow = {
  id: string;
  name: string;
  abbreviation?: string | null;
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
      { success: false, error: apiText(request, "universityNameMin2") },
      { status: 400 },
    );
  }

  if (name.length > 160) {
    return NextResponse.json(
      { success: false, error: apiText(request, "universityNameTooLong") },
      { status: 400 },
    );
  }

  const normalizedName = normalizeUniversityName(name);
  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("university_references")
    .select("id, name, abbreviation")
    .eq("normalized_name", normalizedName)
    .maybeSingle<UniversityRow>();

  if (existing) {
    return NextResponse.json({
      success: true,
      created: false,
      item: {
        ...existing,
        displayName: buildUniversityDisplayName(
          existing.name,
          existing.abbreviation,
        ),
      },
    });
  }

  const { data, error } = await supabase
    .from("university_references")
    .insert({
      name,
      normalized_name: normalizedName,
      abbreviation: null,
      normalized_abbreviation: null,
      source: "manual",
      last_seen_at: new Date().toISOString(),
    })
    .select("id, name, abbreviation")
    .single<UniversityRow>();

  if (error && isUniqueViolation(error)) {
    const { data: retryExisting } = await supabase
      .from("university_references")
      .select("id, name, abbreviation")
      .eq("normalized_name", normalizedName)
      .maybeSingle<UniversityRow>();

    if (retryExisting) {
      return NextResponse.json({
        success: true,
        created: false,
        item: {
          ...retryExisting,
          displayName: buildUniversityDisplayName(
            retryExisting.name,
            retryExisting.abbreviation,
          ),
        },
      });
    }
  }

  if (error || !data) {
    return NextResponse.json(
      { success: false, error: error?.message || apiText(request, "failedCreateUniversity") },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    created: true,
    item: {
      ...data,
      displayName: buildUniversityDisplayName(data.name, data.abbreviation),
    },
  });
}
