import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { cache } from "react";
import {
  BookingFormClient,
  type Service,
  type Vendor,
} from "./[vendorSlug]/booking-form-client";
import { getTenantConfig } from "@/lib/tenant-config";
import {
  isMainClientDeskDomain,
  normalizeHost,
  normalizeVendorSlug,
} from "@/lib/booking-url-mode";
import {
  type BookingSpecialOfferStatus,
  isBookingSpecialLinkAvailable,
  normalizeBookingSpecialLinkRule,
  normalizeSpecialOfferToken,
} from "@/lib/booking-special-offer";
import { getVendorPublicPayloadForTenantCached } from "@/lib/public-vendor-data";

export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ offer?: string | string[] }>;
}

function getCopy(locale: string) {
  if (locale === "en") {
    return {
      useSlugTitle: "Booking URL Requires Vendor Slug",
      useSlugBody:
        "This domain requires a slug-based URL. Open the booking form with /{locale}/formbooking/{slug}.",
      setupTitle: "Slugless Booking Is Not Ready",
      setupBody:
        "Ask tenant admin to enable Disable slug and set a default booking vendor slug first.",
      vendorNotFoundTitle: "Default Booking Vendor Not Found",
      vendorNotFoundBody:
        "Current slugless configuration points to a vendor that does not exist in this tenant.",
      title: "Booking Form",
    };
  }

  return {
    useSlugTitle: "URL Booking Wajib Pakai Slug Vendor",
    useSlugBody:
      "Domain ini tetap memakai pola URL dengan slug. Buka form booking melalui /{locale}/formbooking/{slug}.",
    setupTitle: "Mode Booking Tanpa Slug Belum Siap",
    setupBody:
      "Minta admin tenant untuk aktifkan Disable slug dan set default booking vendor slug terlebih dulu.",
    vendorNotFoundTitle: "Default Vendor Booking Tidak Ditemukan",
    vendorNotFoundBody:
      "Konfigurasi slugless saat ini mengarah ke vendor yang tidak ada di tenant ini.",
    title: "Form Booking",
  };
}

function InfoState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="public-light-theme min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="text-center space-y-3 max-w-lg mx-auto px-6">
        <h2 className="text-2xl font-bold">{title}</h2>
        <p className="text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

const resolveSluglessVendor = cache(async (locale: string) => {
  const copy = getCopy(locale);
  const tenant = await getTenantConfig();
  const headersList = await headers();
  const host = normalizeHost(
    headersList.get("x-forwarded-host") || headersList.get("host"),
  );
  const isMainDomain = isMainClientDeskDomain(host || tenant.domain);

  if (isMainDomain || !tenant.disableBookingSlug) {
    return {
      state: "needs-slug" as const,
      copy,
    };
  }

  const defaultVendorSlug = normalizeVendorSlug(tenant.defaultBookingVendorSlug);
  if (!defaultVendorSlug) {
    return {
      state: "missing-default-slug" as const,
      copy,
    };
  }

  const vendorPayload = await getVendorPublicPayloadForTenantCached(
    tenant.id,
    defaultVendorSlug,
  );
  if (!vendorPayload) {
    return {
      state: "vendor-not-found" as const,
      copy,
    };
  }

  return {
    state: "ready" as const,
    copy,
    vendorSlug: defaultVendorSlug,
    vendor: vendorPayload.vendor as Vendor,
    services: vendorPayload.services as Service[],
  };
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const resolved = await resolveSluglessVendor(locale);
  if (resolved.state !== "ready") {
    return {
      title: resolved.copy.title,
      description: resolved.copy.useSlugBody,
    };
  }

  return {
    title: `Form Booking — ${resolved.vendor.studio_name || "Studio"}`,
    description:
      resolved.vendor.form_greeting ||
      `Booking sesi foto bersama ${resolved.vendor.studio_name || "Studio"}.`,
  };
}

export default async function SluglessBookingPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const resolved = await resolveSluglessVendor(locale);

  if (resolved.state === "needs-slug") {
    return (
      <InfoState
        title={resolved.copy.useSlugTitle}
        body={resolved.copy.useSlugBody}
      />
    );
  }

  if (resolved.state === "missing-default-slug") {
    return (
      <InfoState
        title={resolved.copy.setupTitle}
        body={resolved.copy.setupBody}
      />
    );
  }

  if (resolved.state === "vendor-not-found") {
    return (
      <InfoState
        title={resolved.copy.vendorNotFoundTitle}
        body={resolved.copy.vendorNotFoundBody}
      />
    );
  }

  const resolvedSearchParams = searchParams ? await searchParams : null;
  const offerQueryValue = Array.isArray(resolvedSearchParams?.offer)
    ? resolvedSearchParams.offer[0]
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
  } | null = null;
  let specialOfferStatus: BookingSpecialOfferStatus = offerToken
    ? "expired"
    : "none";

  if (offerToken) {
    const { data: specialOfferRow } = await supabaseAdmin
      .from("booking_special_links")
      .select(
        "id, token, user_id, name, event_type_locked, event_types, package_locked, package_service_ids, addon_locked, addon_service_ids, accommodation_fee, discount_amount, is_active, consumed_at, consumed_booking_id",
      )
      .eq("token", offerToken)
      .eq("user_id", resolved.vendor.id)
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
      };
    }
  }

  return (
    <BookingFormClient
      vendorSlug={resolved.vendorSlug}
      vendor={resolved.vendor}
      services={resolved.services}
      specialOfferToken={offerToken || null}
      specialOfferStatus={specialOfferStatus}
      specialOfferRule={specialOfferRule}
    />
  );
}
