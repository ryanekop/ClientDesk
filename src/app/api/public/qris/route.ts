import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildDriveImageUrl, isLegacyDriveImageUrl } from "@/lib/payment-config";
import { getDriveFilePublicLinks } from "@/utils/google/drive";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

type ProfileRecord = {
  qris_image_url: string | null;
  qris_drive_file_id: string | null;
  google_drive_access_token: string | null;
  google_drive_refresh_token: string | null;
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function redirectTo(request: NextRequest, url: string) {
  const target = new URL(url, request.nextUrl.origin);
  return NextResponse.redirect(target, {
    status: 302,
    headers: {
      "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

async function loadProfileByVendorSlug(vendorSlug: string) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select(
      "qris_image_url, qris_drive_file_id, google_drive_access_token, google_drive_refresh_token",
    )
    .eq("vendor_slug", vendorSlug)
    .maybeSingle<ProfileRecord>();

  return data;
}

async function loadProfileByTrackingUuid(trackingUuid: string) {
  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select("user_id")
    .eq("tracking_uuid", trackingUuid)
    .maybeSingle<{ user_id: string }>();

  if (!booking?.user_id) return null;

  const { data } = await supabaseAdmin
    .from("profiles")
    .select(
      "qris_image_url, qris_drive_file_id, google_drive_access_token, google_drive_refresh_token",
    )
    .eq("id", booking.user_id)
    .maybeSingle<ProfileRecord>();

  return data;
}

export async function GET(request: NextRequest) {
  const rateLimitedResponse = enforceRateLimit({
    request,
    namespace: "public-get-qris",
    maxRequests: 60,
    windowMs: 60 * 1000,
  });
  if (rateLimitedResponse) {
    return rateLimitedResponse;
  }

  const vendorSlug = request.nextUrl.searchParams.get("vendorSlug")?.trim() || "";
  const trackingUuid = request.nextUrl.searchParams.get("trackingUuid")?.trim() || "";

  if (!vendorSlug && !trackingUuid) {
    return NextResponse.json(
      { success: false, error: "vendorSlug atau trackingUuid wajib diisi." },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
        },
      },
    );
  }

  const profile = vendorSlug
    ? await loadProfileByVendorSlug(vendorSlug)
    : await loadProfileByTrackingUuid(trackingUuid);

  if (!profile) {
    return NextResponse.json(
      { success: false, error: "QRIS vendor tidak ditemukan." },
      {
        status: 404,
        headers: {
          "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
        },
      },
    );
  }

  const fallbackUrl =
    (isLegacyDriveImageUrl(profile.qris_image_url) ? "" : profile.qris_image_url?.trim()) ||
    (profile.qris_drive_file_id?.trim()
      ? buildDriveImageUrl(profile.qris_drive_file_id)
      : "");

  if (!profile.qris_drive_file_id?.trim()) {
    if (fallbackUrl) {
      return redirectTo(request, fallbackUrl);
    }

    return NextResponse.json(
      { success: false, error: "QRIS tidak tersedia." },
      {
        status: 404,
        headers: {
          "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
        },
      },
    );
  }

  if (
    !profile.google_drive_access_token ||
    !profile.google_drive_refresh_token
  ) {
    return redirectTo(
      request,
      fallbackUrl || buildDriveImageUrl(profile.qris_drive_file_id),
    );
  }

  try {
    const publicLinks = await getDriveFilePublicLinks(
      profile.google_drive_access_token,
      profile.google_drive_refresh_token,
      profile.qris_drive_file_id,
    );

    return redirectTo(request, publicLinks.preferredUrl);
  } catch {
    return redirectTo(
      request,
      fallbackUrl || buildDriveImageUrl(profile.qris_drive_file_id),
    );
  }
}
