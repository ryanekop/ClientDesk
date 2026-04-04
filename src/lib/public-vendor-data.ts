import { unstable_cache } from "next/cache";
import {
  normalizeBankAccounts,
  normalizePaymentMethods,
  resolveDriveImageUrl,
} from "@/lib/payment-config";
import {
  buildVendorCacheTag,
  buildVendorUserCacheTag,
} from "@/lib/public-cache-tags";
import { createServiceClient } from "@/lib/supabase/service";
import { normalizeCityCode, type CityReferenceItem } from "@/lib/city-references";

type VendorStampRow = {
  id: string;
  vendor_slug: string | null;
  updated_at: string | null;
};

type VendorProfileRow = {
  id: string;
  vendor_slug: string | null;
  studio_name: string | null;
  whatsapp_number: string | null;
  min_dp_percent: number | null;
  min_dp_map: Record<string, number | { mode: string; value: number }> | null;
  avatar_url: string | null;
  invoice_logo_url: string | null;
  seo_meta_title: string | null;
  seo_meta_description: string | null;
  seo_meta_keywords: string | null;
  seo_og_image_url: string | null;
  seo_form_meta_title: string | null;
  seo_form_meta_description: string | null;
  seo_form_meta_keywords: string | null;
  seo_form_og_image_url: string | null;
  seo_track_meta_title: string | null;
  seo_track_meta_description: string | null;
  seo_track_meta_keywords: string | null;
  seo_track_og_image_url: string | null;
  seo_settlement_meta_title: string | null;
  seo_settlement_meta_description: string | null;
  seo_settlement_meta_keywords: string | null;
  seo_settlement_og_image_url: string | null;
  form_brand_color: string | null;
  form_greeting: string | null;
  form_event_types: string[] | null;
  custom_event_types: string[] | null;
  form_show_location: boolean | null;
  form_show_notes: boolean | null;
  form_show_addons: boolean | null;
  form_hide_service_prices: boolean | null;
  form_show_wedding_split: boolean | null;
  form_show_wisuda_split: boolean | null;
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
  bank_accounts: unknown[] | null;
};

type VendorServiceRow = {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
  description: string | null;
  color: string | null;
  event_types: string[] | null;
  is_addon: boolean;
  is_public: boolean;
  duration_minutes: number | null;
  affects_schedule: boolean | null;
  sort_order: number | null;
  created_at: string;
  city_codes: string[];
};

type ServiceCityScopeRow = {
  service_id: string;
  city_code: string;
};

type CityReferenceRow = {
  city_code: string;
  city_name: string;
  province_code: string;
  province_name: string;
};

export type PublicVendorPayload = {
  vendor: {
    id: string;
    vendor_slug: string | null;
    studio_name: string | null;
    whatsapp_number: string | null;
    min_dp_percent: number | null;
    min_dp_map: Record<string, number | { mode: string; value: number }>;
    avatar_url: string | null;
    invoice_logo_url: string | null;
    seo_meta_title: string | null;
    seo_meta_description: string | null;
    seo_meta_keywords: string | null;
    seo_og_image_url: string | null;
    seo_form_meta_title: string | null;
    seo_form_meta_description: string | null;
    seo_form_meta_keywords: string | null;
    seo_form_og_image_url: string | null;
    seo_track_meta_title: string | null;
    seo_track_meta_description: string | null;
    seo_track_meta_keywords: string | null;
    seo_track_og_image_url: string | null;
    seo_settlement_meta_title: string | null;
    seo_settlement_meta_description: string | null;
    seo_settlement_meta_keywords: string | null;
    seo_settlement_og_image_url: string | null;
    form_brand_color: string;
    form_greeting: string | null;
    form_event_types: string[] | null;
    custom_event_types: string[];
    form_show_location: boolean;
    form_show_notes: boolean;
    form_show_addons: boolean;
    form_hide_service_prices: boolean;
    form_show_wedding_split: boolean;
    form_show_wisuda_split: boolean;
    form_show_proof: boolean;
    form_terms_enabled: boolean;
    form_terms_agreement_text: string | null;
    form_terms_link_text: string | null;
    form_terms_suffix_text: string | null;
    form_terms_content: string | null;
    form_sections: unknown[] | Record<string, unknown[]>;
    form_payment_methods: string[];
    qris_image_url: string | null;
    bank_accounts: ReturnType<typeof normalizeBankAccounts>;
  };
  services: VendorServiceRow[];
  cities: CityReferenceItem[];
};

function normalizeSlug(slug: string | null | undefined) {
  return (slug || "").trim();
}

function isMissingColumnError(message: string | null | undefined) {
  const text = (message || "").toLowerCase();
  return text.includes("could not find") || text.includes("does not exist");
}

async function fetchVendorStamp(args: {
  vendorSlug: string;
  tenantId?: string | null;
}) {
  const supabase = createServiceClient();
  const selectVendorStamp = () =>
    supabase
      .from("profiles")
      .select("id, vendor_slug, updated_at")
      .eq("vendor_slug", args.vendorSlug);

  if (args.tenantId) {
    const { data, error } = await selectVendorStamp()
      .eq("tenant_id", args.tenantId)
      .maybeSingle<VendorStampRow>();
    if (!error) {
      return data || null;
    }

    if (!/tenant_id|column/i.test(error.message || "")) {
      return null;
    }
  }

  const { data } = await selectVendorStamp().maybeSingle<VendorStampRow>();
  return data || null;
}

async function fetchVendorPayloadById(args: {
  vendorId: string;
  vendorSlugForQris: string;
}) {
  const supabase = createServiceClient();
  const profileSelectBase =
    "id, vendor_slug, studio_name, whatsapp_number, min_dp_percent, min_dp_map, " +
    "avatar_url, invoice_logo_url, " +
    "form_brand_color, form_greeting, " +
    "form_event_types, custom_event_types, form_show_location, form_show_notes, form_show_addons, form_hide_service_prices, form_show_wedding_split, form_show_wisuda_split, form_show_proof, " +
    "form_terms_enabled, form_terms_agreement_text, form_terms_link_text, form_terms_suffix_text, form_terms_content, " +
    "form_sections, form_payment_methods, qris_image_url, qris_drive_file_id, bank_accounts";
  const profileSelectWithSeo =
    "seo_meta_title, seo_meta_description, seo_meta_keywords, seo_og_image_url, " +
    "seo_form_meta_title, seo_form_meta_description, seo_form_meta_keywords, seo_form_og_image_url, " +
    "seo_track_meta_title, seo_track_meta_description, seo_track_meta_keywords, seo_track_og_image_url, " +
    "seo_settlement_meta_title, seo_settlement_meta_description, seo_settlement_meta_keywords, seo_settlement_og_image_url";
  const profileSelect = `${profileSelectBase}, ${profileSelectWithSeo}`;

  const { data: vendorWithSeo, error: vendorWithSeoError } = await supabase
    .from("profiles")
    .select(profileSelect)
    .eq("id", args.vendorId)
    .maybeSingle<VendorProfileRow>();

  let vendorRaw = vendorWithSeo;
  if (!vendorRaw && vendorWithSeoError && isMissingColumnError(vendorWithSeoError.message)) {
    const { data: vendorLegacy } = await supabase
      .from("profiles")
      .select(profileSelectBase)
      .eq("id", args.vendorId)
      .maybeSingle<Omit<
        VendorProfileRow,
        | "seo_meta_title"
        | "seo_meta_description"
        | "seo_meta_keywords"
        | "seo_og_image_url"
        | "seo_form_meta_title"
        | "seo_form_meta_description"
        | "seo_form_meta_keywords"
        | "seo_form_og_image_url"
        | "seo_track_meta_title"
        | "seo_track_meta_description"
        | "seo_track_meta_keywords"
        | "seo_track_og_image_url"
        | "seo_settlement_meta_title"
        | "seo_settlement_meta_description"
        | "seo_settlement_meta_keywords"
        | "seo_settlement_og_image_url"
      >>();

    if (vendorLegacy) {
      vendorRaw = {
        ...vendorLegacy,
        seo_meta_title: null,
        seo_meta_description: null,
        seo_meta_keywords: null,
        seo_og_image_url: null,
        seo_form_meta_title: null,
        seo_form_meta_description: null,
        seo_form_meta_keywords: null,
        seo_form_og_image_url: null,
        seo_track_meta_title: null,
        seo_track_meta_description: null,
        seo_track_meta_keywords: null,
        seo_track_og_image_url: null,
        seo_settlement_meta_title: null,
        seo_settlement_meta_description: null,
        seo_settlement_meta_keywords: null,
        seo_settlement_og_image_url: null,
      };
    }
  }

  if (!vendorRaw) {
    return null;
  }

  const { data: services } = await supabase
    .from("services")
    .select(
      "id, name, price, original_price, description, color, event_types, is_addon, is_public, duration_minutes, affects_schedule, sort_order, created_at",
    )
    .eq("user_id", vendorRaw.id)
    .eq("is_active", true)
    .eq("is_public", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const serviceIds = ((services || []) as Array<{ id: string }>).map((service) => service.id);
  let serviceScopeRows: ServiceCityScopeRow[] = [];
  if (serviceIds.length > 0) {
    const { data: scopeData, error: scopeError } = await supabase
      .from("service_city_scopes")
      .select("service_id, city_code")
      .eq("user_id", vendorRaw.id)
      .in("service_id", serviceIds);
    if (!scopeError) {
      serviceScopeRows = (scopeData || []) as ServiceCityScopeRow[];
    }
  }

  const { data: cityData, error: cityError } = await supabase
    .from("region_city_references")
    .select("city_code, city_name, province_code, province_name")
    .order("province_code", { ascending: true })
    .order("city_name", { ascending: true });
  const cityRows: CityReferenceRow[] = cityError
    ? []
    : ((cityData || []) as CityReferenceRow[]);

  const cityCodesByService = new Map<string, string[]>();
  serviceScopeRows.forEach((row) => {
    const cityCode = normalizeCityCode(row.city_code);
    if (!cityCode) return;
    const current = cityCodesByService.get(row.service_id) || [];
    if (!current.includes(cityCode)) {
      current.push(cityCode);
    }
    cityCodesByService.set(row.service_id, current);
  });

  const payload: PublicVendorPayload = {
    vendor: {
      id: vendorRaw.id,
      vendor_slug: vendorRaw.vendor_slug ?? null,
      studio_name: vendorRaw.studio_name ?? null,
      whatsapp_number: vendorRaw.whatsapp_number ?? null,
      min_dp_percent: vendorRaw.min_dp_percent ?? null,
      min_dp_map: vendorRaw.min_dp_map || {},
      avatar_url: vendorRaw.avatar_url ?? null,
      invoice_logo_url: vendorRaw.invoice_logo_url ?? null,
      seo_meta_title: vendorRaw.seo_meta_title ?? null,
      seo_meta_description: vendorRaw.seo_meta_description ?? null,
      seo_meta_keywords: vendorRaw.seo_meta_keywords ?? null,
      seo_og_image_url: vendorRaw.seo_og_image_url ?? null,
      seo_form_meta_title: vendorRaw.seo_form_meta_title ?? null,
      seo_form_meta_description: vendorRaw.seo_form_meta_description ?? null,
      seo_form_meta_keywords: vendorRaw.seo_form_meta_keywords ?? null,
      seo_form_og_image_url: vendorRaw.seo_form_og_image_url ?? null,
      seo_track_meta_title: vendorRaw.seo_track_meta_title ?? null,
      seo_track_meta_description: vendorRaw.seo_track_meta_description ?? null,
      seo_track_meta_keywords: vendorRaw.seo_track_meta_keywords ?? null,
      seo_track_og_image_url: vendorRaw.seo_track_og_image_url ?? null,
      seo_settlement_meta_title: vendorRaw.seo_settlement_meta_title ?? null,
      seo_settlement_meta_description: vendorRaw.seo_settlement_meta_description ?? null,
      seo_settlement_meta_keywords: vendorRaw.seo_settlement_meta_keywords ?? null,
      seo_settlement_og_image_url: vendorRaw.seo_settlement_og_image_url ?? null,
      form_brand_color: vendorRaw.form_brand_color || "#000000",
      form_greeting: vendorRaw.form_greeting ?? null,
      form_event_types: vendorRaw.form_event_types || null,
      custom_event_types: vendorRaw.custom_event_types || [],
      form_show_location: vendorRaw.form_show_location ?? true,
      form_show_notes: vendorRaw.form_show_notes ?? true,
      form_show_addons: vendorRaw.form_show_addons ?? true,
      form_hide_service_prices: vendorRaw.form_hide_service_prices ?? false,
      form_show_wedding_split: vendorRaw.form_show_wedding_split ?? true,
      form_show_wisuda_split: vendorRaw.form_show_wisuda_split ?? true,
      form_show_proof: vendorRaw.form_show_proof ?? true,
      form_terms_enabled: vendorRaw.form_terms_enabled ?? false,
      form_terms_agreement_text: vendorRaw.form_terms_agreement_text || null,
      form_terms_link_text: vendorRaw.form_terms_link_text || null,
      form_terms_suffix_text: vendorRaw.form_terms_suffix_text || null,
      form_terms_content: vendorRaw.form_terms_content || null,
      form_sections: vendorRaw.form_sections || [],
      form_payment_methods: normalizePaymentMethods(vendorRaw.form_payment_methods),
      qris_image_url: resolveDriveImageUrl(
        vendorRaw.qris_image_url,
        vendorRaw.qris_drive_file_id,
        { vendorSlug: args.vendorSlugForQris },
      ),
      bank_accounts: normalizeBankAccounts(vendorRaw.bank_accounts),
    },
    services: ((services || []) as Omit<VendorServiceRow, "city_codes">[]).map(
      (service) => ({
        ...service,
        city_codes: cityCodesByService.get(service.id) || [],
      }),
    ),
    cities: cityRows
      .map((city) => ({
        city_code: normalizeCityCode(city.city_code),
        city_name: city.city_name,
        province_code: city.province_code,
        province_name: city.province_name,
      }))
      .filter((city) => city.city_code),
  };

  return payload;
}

async function getVendorPayloadByStamp(stamp: VendorStampRow, tenantId?: string | null) {
  const normalizedSlug = normalizeSlug(stamp.vendor_slug);
  const cacheKey = [
    "public-vendor-payload",
    tenantId ? tenantId.trim().toLowerCase() : "global",
    normalizedSlug.toLowerCase(),
    stamp.id,
    stamp.updated_at || "no-updated-at",
  ];

  const cached = unstable_cache(
    async () =>
      fetchVendorPayloadById({
        vendorId: stamp.id,
        vendorSlugForQris: normalizedSlug,
      }),
    cacheKey,
    {
      revalidate: false,
      tags: [
        buildVendorCacheTag(normalizedSlug),
        buildVendorUserCacheTag(stamp.id),
      ],
    },
  );

  return cached();
}

export async function getVendorPublicPayloadCached(vendorSlug: string) {
  const normalizedSlug = normalizeSlug(vendorSlug);
  if (!normalizedSlug) return null;

  const stamp = await fetchVendorStamp({ vendorSlug: normalizedSlug });
  if (!stamp) return null;

  return getVendorPayloadByStamp(stamp, null);
}

export async function getVendorPublicPayloadForTenantCached(
  tenantId: string,
  vendorSlug: string,
) {
  const normalizedSlug = normalizeSlug(vendorSlug);
  const normalizedTenantId = (tenantId || "").trim();
  if (!normalizedSlug || !normalizedTenantId) return null;

  const stamp = await fetchVendorStamp({
    vendorSlug: normalizedSlug,
    tenantId: normalizedTenantId,
  });
  if (!stamp) return null;

  return getVendorPayloadByStamp(stamp, normalizedTenantId);
}
