import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import { headers } from "next/headers";
import {
  BookingFormClient,
  type Service,
  type Vendor,
} from "./[vendorSlug]/booking-form-client";
import {
  normalizeBankAccounts,
  normalizePaymentMethods,
  resolveDriveImageUrl,
} from "@/lib/payment-config";
import { getTenantConfig } from "@/lib/tenant-config";
import {
  isMainClientDeskDomain,
  normalizeHost,
  normalizeVendorSlug,
} from "@/lib/booking-url-mode";
import {
  isBookingSpecialLinkAvailable,
  normalizeBookingSpecialLinkRule,
  normalizeSpecialOfferToken,
} from "@/lib/booking-special-offer";

type RawVendor = {
  id: string;
  studio_name: string | null;
  whatsapp_number: string | null;
  min_dp_percent: number | null;
  min_dp_map: Record<string, number | { mode: string; value: number }> | null;
  avatar_url: string | null;
  invoice_logo_url: string | null;
  form_brand_color: string | null;
  form_greeting: string | null;
  form_event_types: string[] | null;
  custom_event_types: string[] | null;
  form_show_location: boolean | null;
  form_show_notes: boolean | null;
  form_show_addons: boolean | null;
  form_show_proof: boolean | null;
  form_terms_enabled: boolean | null;
  form_terms_agreement_text: string | null;
  form_terms_link_text: string | null;
  form_terms_suffix_text: string | null;
  form_terms_content: string | null;
  form_sections: unknown[] | Record<string, unknown[]> | null;
  form_payment_methods: string[] | null;
  qris_image_url: string | null;
  qris_drive_file_id: string | null;
  bank_accounts: Vendor["bank_accounts"] | null;
};

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

async function fetchVendorForTenant(tenantId: string, vendorSlug: string) {
  const { data: vendor } = (await supabaseAdmin
    .from("profiles")
    .select(
      "id, studio_name, whatsapp_number, min_dp_percent, min_dp_map, " +
        "avatar_url, invoice_logo_url, form_brand_color, form_greeting, " +
        "form_event_types, custom_event_types, form_show_location, form_show_notes, form_show_addons, form_show_proof, " +
        "form_terms_enabled, form_terms_agreement_text, form_terms_link_text, form_terms_suffix_text, form_terms_content, " +
        "form_sections, form_payment_methods, qris_image_url, qris_drive_file_id, bank_accounts",
    )
    .eq("tenant_id", tenantId)
    .eq("vendor_slug", vendorSlug)
    .maybeSingle()) as { data: RawVendor | null; error: unknown };

  return vendor;
}

async function fetchServices(vendorId: string) {
  const { data: services } = (await supabaseAdmin
    .from("services")
    .select(
      "id, name, price, original_price, description, event_types, is_addon, is_public, sort_order, created_at",
    )
    .eq("user_id", vendorId)
    .eq("is_active", true)
    .eq("is_public", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })) as {
    data: Service[] | null;
    error: unknown;
  };

  return (services ?? []) as Service[];
}

function normalizeVendor(vendor: RawVendor): Vendor {
  return {
    id: vendor.id,
    studio_name: vendor.studio_name ?? null,
    whatsapp_number: vendor.whatsapp_number ?? null,
    min_dp_percent: vendor.min_dp_percent ?? null,
    min_dp_map:
      (vendor.min_dp_map as Record<
        string,
        number | { mode: string; value: number }
      > | null) ?? null,
    avatar_url: vendor.avatar_url ?? null,
    invoice_logo_url: vendor.invoice_logo_url ?? null,
    form_brand_color: vendor.form_brand_color ?? "#000000",
    form_greeting: vendor.form_greeting ?? null,
    form_event_types: (vendor.form_event_types as string[] | null) ?? null,
    custom_event_types: (vendor.custom_event_types as string[]) ?? [],
    form_show_location: vendor.form_show_location ?? true,
    form_show_notes: vendor.form_show_notes ?? true,
    form_show_addons: vendor.form_show_addons ?? true,
    form_show_proof: vendor.form_show_proof ?? true,
    form_terms_enabled: vendor.form_terms_enabled ?? false,
    form_terms_agreement_text: vendor.form_terms_agreement_text ?? null,
    form_terms_link_text: vendor.form_terms_link_text ?? null,
    form_terms_suffix_text: vendor.form_terms_suffix_text ?? null,
    form_terms_content: vendor.form_terms_content ?? null,
    form_sections: (vendor.form_sections as Vendor["form_sections"]) ?? [],
    form_payment_methods: normalizePaymentMethods(vendor.form_payment_methods),
    qris_image_url: resolveDriveImageUrl(
      vendor.qris_image_url,
      vendor.qris_drive_file_id,
    ),
    bank_accounts: normalizeBankAccounts(vendor.bank_accounts),
  };
}

async function resolveSluglessVendor(locale: string) {
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

  const vendor = await fetchVendorForTenant(tenant.id, defaultVendorSlug);
  if (!vendor) {
    return {
      state: "vendor-not-found" as const,
      copy,
    };
  }

  const services = await fetchServices(vendor.id);
  return {
    state: "ready" as const,
    copy,
    vendorSlug: defaultVendorSlug,
    vendor: normalizeVendor(vendor),
    services,
  };
}

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
      specialOfferRule={specialOfferRule}
    />
  );
}
