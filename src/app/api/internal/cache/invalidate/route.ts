import { NextRequest, NextResponse } from "next/server";
import {
  invalidatePublicCachesForBooking,
  invalidatePublicCachesForProfile,
} from "@/lib/public-cache-invalidation";
import { apiText } from "@/lib/i18n/api-errors";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/utils/supabase/server";

type InvalidationScope = "profile" | "booking";

type InvalidationRequestBody = {
  scope?: InvalidationScope;
  vendorSlug?: string | null;
  previousVendorSlug?: string | null;
  bookingCode?: string | null;
  trackingUuid?: string | null;
};

type OwnedBookingRow = {
  booking_code: string;
  tracking_uuid: string | null;
  user_id: string;
};

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

async function getOwnedBookingByCodeOrUuid(args: {
  bookingCode: string | null;
  trackingUuid: string | null;
  userId: string;
}) {
  const supabase = createServiceClient();

  if (args.bookingCode) {
    const { data } = await supabase
      .from("bookings")
      .select("booking_code, tracking_uuid, user_id")
      .eq("booking_code", args.bookingCode)
      .limit(1)
      .maybeSingle<OwnedBookingRow>();

    if (data?.user_id === args.userId) {
      return data;
    }
  }

  if (args.trackingUuid) {
    const { data } = await supabase
      .from("bookings")
      .select("booking_code, tracking_uuid, user_id")
      .eq("tracking_uuid", args.trackingUuid)
      .limit(1)
      .maybeSingle<OwnedBookingRow>();

    if (data?.user_id === args.userId) {
      return data;
    }
  }

  return null;
}

async function getVendorSlugByUserId(userId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("profiles")
    .select("vendor_slug")
    .eq("id", userId)
    .limit(1)
    .maybeSingle<{ vendor_slug: string | null }>();

  return normalizeOptionalString(data?.vendor_slug);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { success: false, error: apiText(request, "unauthorized") },
      { status: 401 },
    );
  }

  const payload = (await request.json().catch(() => null)) as
    | InvalidationRequestBody
    | null;
  const scope = payload?.scope;

  if (!scope) {
    return NextResponse.json(
      { success: false, error: apiText(request, "scopeRequired") },
      { status: 400 },
    );
  }

  if (scope === "profile") {
    const vendorSlug =
      normalizeOptionalString(payload?.vendorSlug) ||
      (await getVendorSlugByUserId(user.id));

    invalidatePublicCachesForProfile({
      userId: user.id,
      vendorSlug,
      previousVendorSlug: normalizeOptionalString(payload?.previousVendorSlug),
    });

    return NextResponse.json({ success: true });
  }

  if (scope === "booking") {
    const bookingCode = normalizeOptionalString(payload?.bookingCode);
    const trackingUuid = normalizeOptionalString(payload?.trackingUuid);
    if (!bookingCode && !trackingUuid) {
      return NextResponse.json(
        {
          success: false,
          error: apiText(request, "bookingCodeOrTrackingRequired"),
        },
        { status: 400 },
      );
    }

    const ownedBooking = await getOwnedBookingByCodeOrUuid({
      bookingCode,
      trackingUuid,
      userId: user.id,
    });

    if (!ownedBooking) {
      return NextResponse.json(
        { success: false, error: apiText(request, "bookingNotFound") },
        { status: 404 },
      );
    }

    const vendorSlug =
      normalizeOptionalString(payload?.vendorSlug) ||
      (await getVendorSlugByUserId(user.id));

    invalidatePublicCachesForBooking({
      bookingCode: ownedBooking.booking_code,
      trackingUuid: ownedBooking.tracking_uuid,
      userId: user.id,
      vendorSlug,
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json(
    { success: false, error: apiText(request, "unsupportedScope") },
    { status: 400 },
  );
}
