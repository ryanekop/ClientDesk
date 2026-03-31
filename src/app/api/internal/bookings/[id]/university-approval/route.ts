import { NextRequest, NextResponse } from "next/server";

import {
  assertBookingWriteAccessForUser,
  BookingWriteAccessDeniedError,
} from "@/lib/booking-write-access.server";
import { invalidatePublicCachesForBooking } from "@/lib/public-cache-invalidation";
import { requireRouteUser } from "@/lib/pagination/route-user";
import { createServiceClient } from "@/lib/supabase/service";
import {
  buildUniversityDisplayName,
  cleanUniversityAbbreviation,
  cleanUniversityName,
  escapePostgresLikePattern,
  normalizeUniversityAbbreviation,
  normalizeUniversityName,
  UNIVERSITY_ABBREVIATION_DRAFT_EXTRA_KEY,
  UNIVERSITY_EXTRA_FIELD_KEY,
  UNIVERSITY_REFERENCE_EXTRA_KEY,
  type UniversityReferenceItem,
} from "@/lib/university-references";

type ApprovalPayload = {
  name?: unknown;
  abbreviation?: unknown;
  selectedReferenceId?: unknown;
  forceCreate?: unknown;
};

type BookingApprovalRow = {
  id: string;
  user_id: string;
  booking_code: string;
  tracking_uuid: string | null;
  extra_fields: Record<string, unknown> | null;
};

type ProfileRoleRow = {
  role?: string | null;
};

type UniversityReferenceRow = {
  id: string;
  name: string;
  abbreviation?: string | null;
  normalized_name: string;
  normalized_abbreviation?: string | null;
  source?: string | null;
};

function isValidUuid(value: string | null | undefined) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeRole(value: string | null | undefined) {
  if (!value) return "";
  return value.trim().toLowerCase();
}

function isUniqueViolation(error: { code?: string | null } | null | undefined) {
  return error?.code === "23505";
}

function mapUniversityReferenceItem(
  row: Pick<UniversityReferenceRow, "id" | "name" | "abbreviation">,
): UniversityReferenceItem {
  return {
    id: row.id,
    name: row.name,
    abbreviation: row.abbreviation || null,
    displayName: buildUniversityDisplayName(row.name, row.abbreviation),
  };
}

function getSearchRank(
  item: UniversityReferenceRow,
  normalizedQuery: string,
) {
  const abbreviation = item.normalized_abbreviation || "";
  if (item.normalized_name.startsWith(normalizedQuery)) return 0;
  if (abbreviation && abbreviation.startsWith(normalizedQuery)) return 1;
  if (item.normalized_name.includes(normalizedQuery)) return 2;
  if (abbreviation && abbreviation.includes(normalizedQuery)) return 3;
  return 4;
}

function getSourceRank(source: string | null | undefined) {
  const normalizedSource = String(source || "").trim().toLowerCase();
  if (normalizedSource === "kip_kuliah") return 0;
  if (normalizedSource.startsWith("wikipedia_")) return 1;
  if (normalizedSource === "manual") return 2;
  return 3;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { errorResponse, supabase, user } = await requireRouteUser();
    if (errorResponse || !user) {
      return errorResponse;
    }

    await assertBookingWriteAccessForUser(user.id);

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Booking tidak ditemukan." },
        { status: 400 },
      );
    }

    const payload = (await request.json().catch(() => null)) as ApprovalPayload | null;
    const name = cleanUniversityName(
      payload && typeof payload.name === "string" ? payload.name : "",
    );
    const abbreviation = cleanUniversityAbbreviation(
      payload && typeof payload.abbreviation === "string"
        ? payload.abbreviation
        : "",
    );
    const selectedReferenceId =
      payload && typeof payload.selectedReferenceId === "string"
        ? payload.selectedReferenceId.trim()
        : "";
    const forceCreate = payload?.forceCreate === true;

    if (name.length < 2) {
      return NextResponse.json(
        { success: false, error: "Nama universitas minimal 2 karakter." },
        { status: 400 },
      );
    }

    const [{ data: booking, error: bookingError }, { data: profile, error: profileError }] =
      await Promise.all([
        supabase
          .from("bookings")
          .select("id, user_id, booking_code, tracking_uuid, extra_fields")
          .eq("id", id)
          .eq("user_id", user.id)
          .maybeSingle<BookingApprovalRow>(),
        supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle<ProfileRoleRow>(),
      ]);

    if (bookingError) {
      return NextResponse.json(
        { success: false, error: bookingError.message || "Gagal memuat booking." },
        { status: 500 },
      );
    }

    if (!booking) {
      return NextResponse.json(
        { success: false, error: "Booking tidak ditemukan." },
        { status: 404 },
      );
    }

    if (profileError) {
      return NextResponse.json(
        { success: false, error: profileError.message || "Gagal memuat profil." },
        { status: 500 },
      );
    }

    if (normalizeRole(profile?.role) !== "admin") {
      return NextResponse.json(
        { success: false, error: "Hanya admin yang dapat approve universitas." },
        { status: 403 },
      );
    }

    const bookingExtraFields =
      booking.extra_fields && typeof booking.extra_fields === "object"
        ? { ...booking.extra_fields }
        : {};
    const existingBookingUniversity = cleanUniversityName(
      typeof bookingExtraFields[UNIVERSITY_EXTRA_FIELD_KEY] === "string"
        ? bookingExtraFields[UNIVERSITY_EXTRA_FIELD_KEY]
        : "",
    );
    const existingBookingReferenceId =
      typeof bookingExtraFields[UNIVERSITY_REFERENCE_EXTRA_KEY] === "string"
        ? bookingExtraFields[UNIVERSITY_REFERENCE_EXTRA_KEY].trim()
        : "";

    if (!existingBookingUniversity) {
      return NextResponse.json(
        { success: false, error: "Booking ini tidak memiliki draft universitas." },
        { status: 400 },
      );
    }

    if (existingBookingReferenceId) {
      return NextResponse.json(
        { success: false, error: "Universitas booking ini sudah terhubung ke referensi." },
        { status: 400 },
      );
    }

    const normalizedName = normalizeUniversityName(name);
    const normalizedAbbreviation = normalizeUniversityAbbreviation(abbreviation);
    const service = createServiceClient();

    let resolvedReference: UniversityReferenceRow | null = null;

    if (selectedReferenceId) {
      if (!isValidUuid(selectedReferenceId)) {
        return NextResponse.json(
          { success: false, error: "Referensi universitas yang dipilih tidak valid." },
          { status: 400 },
        );
      }

      const { data: selectedReference, error: selectedReferenceError } = await service
        .from("university_references")
        .select("id, name, abbreviation, normalized_name, normalized_abbreviation, source")
        .eq("id", selectedReferenceId)
        .maybeSingle<UniversityReferenceRow>();

      if (selectedReferenceError) {
        return NextResponse.json(
          { success: false, error: selectedReferenceError.message || "Gagal memuat referensi universitas." },
          { status: 500 },
        );
      }

      if (!selectedReference) {
        return NextResponse.json(
          { success: false, error: "Referensi universitas yang dipilih tidak ditemukan." },
          { status: 404 },
        );
      }

      resolvedReference = selectedReference;
    }

    if (!resolvedReference) {
      const { data: exactReference, error: exactReferenceError } = await service
        .from("university_references")
        .select("id, name, abbreviation, normalized_name, normalized_abbreviation, source")
        .eq("normalized_name", normalizedName)
        .maybeSingle<UniversityReferenceRow>();

      if (exactReferenceError) {
        return NextResponse.json(
          { success: false, error: exactReferenceError.message || "Gagal memvalidasi universitas." },
          { status: 500 },
        );
      }

      if (exactReference) {
        resolvedReference = exactReference;
      }
    }

    if (!resolvedReference && !forceCreate) {
      const { data: similarRows, error: similarRowsError } = await service
        .from("university_references")
        .select("id, name, abbreviation, normalized_name, normalized_abbreviation, source")
        .or(
          [
            `normalized_name.ilike.%${escapePostgresLikePattern(normalizedName)}%`,
            normalizedAbbreviation
              ? `normalized_abbreviation.ilike.%${escapePostgresLikePattern(normalizedAbbreviation)}%`
              : "",
          ]
            .filter(Boolean)
            .join(","),
        )
        .limit(8);

      if (similarRowsError) {
        return NextResponse.json(
          { success: false, error: similarRowsError.message || "Gagal mencari kandidat universitas." },
          { status: 500 },
        );
      }

      const candidates = ((similarRows || []) as UniversityReferenceRow[])
        .sort((left, right) => {
          const leftRank = getSearchRank(left, normalizedName);
          const rightRank = getSearchRank(right, normalizedName);
          if (leftRank !== rightRank) return leftRank - rightRank;
          const leftSourceRank = getSourceRank(left.source);
          const rightSourceRank = getSourceRank(right.source);
          if (leftSourceRank !== rightSourceRank) return leftSourceRank - rightSourceRank;
          return buildUniversityDisplayName(
            left.name,
            left.abbreviation,
          ).localeCompare(
            buildUniversityDisplayName(right.name, right.abbreviation),
            "id",
          );
        })
        .slice(0, 5)
        .map(mapUniversityReferenceItem);

      if (candidates.length > 0) {
        return NextResponse.json(
          {
            success: false,
            code: "similar_university_candidates",
            error: "Ditemukan universitas serupa. Pilih yang sudah ada atau lanjut buat baru.",
            candidates,
          },
          { status: 409 },
        );
      }
    }

    if (!resolvedReference) {
      const { data: createdReference, error: createReferenceError } = await service
        .from("university_references")
        .insert({
          name,
          normalized_name: normalizedName,
          abbreviation: abbreviation || null,
          normalized_abbreviation: normalizedAbbreviation || null,
          source: "manual",
          last_seen_at: new Date().toISOString(),
        })
        .select("id, name, abbreviation, normalized_name, normalized_abbreviation, source")
        .single<UniversityReferenceRow>();

      if (createReferenceError && isUniqueViolation(createReferenceError)) {
        const { data: retryReference, error: retryReferenceError } = await service
          .from("university_references")
          .select("id, name, abbreviation, normalized_name, normalized_abbreviation, source")
          .eq("normalized_name", normalizedName)
          .maybeSingle<UniversityReferenceRow>();

        if (retryReferenceError) {
          return NextResponse.json(
            { success: false, error: retryReferenceError.message || "Gagal memuat referensi universitas." },
            { status: 500 },
          );
        }

        resolvedReference = retryReference || null;
      } else if (createReferenceError) {
        return NextResponse.json(
          { success: false, error: createReferenceError.message || "Gagal membuat referensi universitas." },
          { status: 500 },
        );
      } else {
        resolvedReference = createdReference;
      }
    }

    if (!resolvedReference) {
      return NextResponse.json(
        { success: false, error: "Gagal menentukan referensi universitas." },
        { status: 500 },
      );
    }

    const nextExtraFields = {
      ...bookingExtraFields,
      [UNIVERSITY_EXTRA_FIELD_KEY]: buildUniversityDisplayName(
        resolvedReference.name,
        resolvedReference.abbreviation,
      ),
      [UNIVERSITY_REFERENCE_EXTRA_KEY]: resolvedReference.id,
    } as Record<string, unknown>;
    delete nextExtraFields[UNIVERSITY_ABBREVIATION_DRAFT_EXTRA_KEY];

    const { error: updateBookingError } = await service
      .from("bookings")
      .update({
        extra_fields: nextExtraFields,
        updated_at: new Date().toISOString(),
      })
      .eq("id", booking.id)
      .eq("user_id", booking.user_id);

    if (updateBookingError) {
      return NextResponse.json(
        { success: false, error: updateBookingError.message || "Gagal menyimpan approval universitas." },
        { status: 500 },
      );
    }

    invalidatePublicCachesForBooking({
      bookingCode: booking.booking_code,
      trackingUuid: booking.tracking_uuid,
      userId: booking.user_id,
      vendorSlug: null,
    });

    return NextResponse.json({
      success: true,
      item: mapUniversityReferenceItem(resolvedReference),
      extraFields: nextExtraFields,
    });
  } catch (error: unknown) {
    if (error instanceof BookingWriteAccessDeniedError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error && error.message
            ? error.message
            : "Gagal memproses approval universitas.",
      },
      { status: 500 },
    );
  }
}
