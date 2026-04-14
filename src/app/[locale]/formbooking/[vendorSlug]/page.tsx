import { createClient } from "@supabase/supabase-js";
import {
  BookingFormClient,
  type Vendor,
  type Service,
} from "./booking-form-client";
import type { Metadata } from "next";
import {
  type BookingSpecialOfferStatus,
  isBookingSpecialLinkAvailable,
  normalizeBookingSpecialLinkRule,
  normalizeSpecialOfferToken,
} from "@/lib/booking-special-offer";
import { getVendorPublicPayloadCached } from "@/lib/public-vendor-data";
import { buildSeoMetadata } from "@/lib/seo-metadata";
import { getTenantConfig } from "@/lib/tenant-config";

export const dynamic = "force-dynamic";

// Admin client — runs server-side only, never exposed to browser
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface PageProps {
  params: Promise<{ vendorSlug: string; locale: string }>;
  searchParams?: Promise<{ offer?: string | string[] }>;
}

// ── Dynamic metadata for SEO & link previews ──────────────────────────────────
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { vendorSlug } = await params;
  const vendorPayload = await getVendorPublicPayloadCached(vendorSlug);
  const vendor = vendorPayload?.vendor;
  const tenant = await getTenantConfig();

  if (!vendor) {
    return { title: "Form Booking" };
  }

  const studioName = vendor.studio_name || "Studio";
  return buildSeoMetadata({
    page: "form",
    profileSeo: vendor,
    variables: {
      studio_name: studioName,
      vendor_slug: vendor.vendor_slug || vendorSlug,
    },
    fallbackTitle: `Form Booking — ${studioName}`,
    fallbackDescription:
      vendor.form_greeting || `Booking sesi foto bersama ${studioName}.`,
    fallbackImageUrl:
      vendor.invoice_logo_url || vendor.avatar_url || tenant.logoUrl || null,
  });
}

// ── Page — Server Component ───────────────────────────────────────────────────
// Data di-fetch langsung di server, bukan di client lewat useEffect.
// Hasilnya: form langsung tampil tanpa loading spinner, tanpa extra round-trip.
export default async function PublicBookingFormPage({
  params,
  searchParams,
}: PageProps) {
  const { vendorSlug } = await params;

  const vendorPayload = await getVendorPublicPayloadCached(vendorSlug);
  const vendor = vendorPayload?.vendor || null;

  // Vendor tidak ditemukan — render langsung di server, tidak perlu client state
  if (!vendor) {
    return (
      <div className="public-light-theme min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center space-y-4 max-w-md mx-auto px-6">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto text-4xl">
            🔍
          </div>
          <h2 className="text-2xl font-bold">Vendor Tidak Ditemukan</h2>
          <p className="text-muted-foreground">
            URL yang Anda akses tidak valid atau vendor belum terdaftar.
          </p>
        </div>
      </div>
    );
  }

  const vendorData = {
    ...vendor,
    min_dp_map: vendor.min_dp_map || {},
    form_sections: vendor.form_sections || [],
  } as Vendor;

  const resolvedSearchParams = searchParams ? await searchParams : null;
  const offerQueryValue = Array.isArray(resolvedSearchParams?.offer)
    ? resolvedSearchParams?.offer[0]
    : resolvedSearchParams?.offer;
  const offerToken = normalizeSpecialOfferToken(offerQueryValue);

  let specialOfferRule: {
    id: string;
    name: string;
    eventTypeLocked: boolean;
    eventTypes: string[];
    packageLocked: boolean;
    packageServiceIds: string[];
    addonLocked: boolean;
    addonServiceIds: string[];
    accommodationFee: number;
    discountAmount: number;
    disableDp: boolean;
  } | null = null;
  let specialOfferStatus: BookingSpecialOfferStatus = offerToken
    ? "expired"
    : "none";

  if (offerToken) {
    const { data: specialOfferRow } = await supabaseAdmin
      .from("booking_special_links")
      .select(
        "id, token, user_id, name, event_type_locked, event_types, package_locked, package_service_ids, addon_locked, addon_service_ids, accommodation_fee, discount_amount, disable_dp, is_active, consumed_at, consumed_booking_id",
      )
      .eq("token", offerToken)
      .eq("user_id", vendor.id)
      .maybeSingle();

    const normalizedRule = normalizeBookingSpecialLinkRule(specialOfferRow);
    if (normalizedRule && isBookingSpecialLinkAvailable(normalizedRule)) {
      specialOfferStatus = "active";
      specialOfferRule = {
        id: normalizedRule.id,
        name: normalizedRule.name,
        eventTypeLocked: normalizedRule.eventTypeLocked,
        eventTypes: normalizedRule.eventTypes,
        packageLocked: normalizedRule.packageLocked,
        packageServiceIds: normalizedRule.packageServiceIds,
        addonLocked: normalizedRule.addonLocked,
        addonServiceIds: normalizedRule.addonServiceIds,
        accommodationFee: normalizedRule.accommodationFee,
        discountAmount: normalizedRule.discountAmount,
        disableDp: normalizedRule.disableDp,
      };
    }
  }

  // Render form — data sudah tersedia, langsung tampil tanpa loading
  return (
    <BookingFormClient
      vendorSlug={vendorSlug}
      vendor={vendorData}
      services={(vendorPayload?.services || []) as Service[]}
      cities={vendorPayload?.cities || []}
      specialOfferToken={offerToken || null}
      specialOfferStatus={specialOfferStatus}
      specialOfferRule={specialOfferRule}
    />
  );
}
