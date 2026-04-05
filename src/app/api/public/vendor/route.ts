import { NextRequest, NextResponse } from "next/server";
import { getVendorPublicPayloadCached } from "@/lib/public-vendor-data";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export async function GET(request: NextRequest) {
  const rateLimitedResponse = enforceRateLimit({
    request,
    namespace: "public-get-vendor",
    maxRequests: 60,
    windowMs: 60 * 1000,
  });
  if (rateLimitedResponse) {
    return rateLimitedResponse;
  }

  const slug = request.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json(
      { success: false, error: "slug required" },
      { status: 400 },
    );
  }

  const payload = await getVendorPublicPayloadCached(slug);
  if (!payload) {
    return NextResponse.json(
      { success: false, error: "Vendor not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    success: true,
    vendor: {
      studio_name: payload.vendor.studio_name,
      whatsapp_number: payload.vendor.whatsapp_number,
      min_dp_percent: payload.vendor.min_dp_percent,
      min_dp_map: payload.vendor.min_dp_map,
      avatar_url: payload.vendor.avatar_url,
      invoice_logo_url: payload.vendor.invoice_logo_url,
      form_brand_color: payload.vendor.form_brand_color,
      form_greeting: payload.vendor.form_greeting,
      form_event_types: payload.vendor.form_event_types,
      custom_event_types: payload.vendor.custom_event_types,
      form_show_location: payload.vendor.form_show_location,
      form_show_notes: payload.vendor.form_show_notes,
      form_show_addons: payload.vendor.form_show_addons,
      form_allow_multiple_packages:
        payload.vendor.form_allow_multiple_packages,
      form_allow_multiple_addons: payload.vendor.form_allow_multiple_addons,
      form_hide_service_prices: payload.vendor.form_hide_service_prices,
      form_show_wedding_split: payload.vendor.form_show_wedding_split,
      form_show_wisuda_split: payload.vendor.form_show_wisuda_split,
      form_show_proof: payload.vendor.form_show_proof,
      form_terms_enabled: payload.vendor.form_terms_enabled,
      form_terms_agreement_text: payload.vendor.form_terms_agreement_text,
      form_terms_link_text: payload.vendor.form_terms_link_text,
      form_terms_suffix_text: payload.vendor.form_terms_suffix_text,
      form_terms_content: payload.vendor.form_terms_content,
      form_sections: payload.vendor.form_sections,
      form_payment_methods: payload.vendor.form_payment_methods,
      qris_image_url: payload.vendor.qris_image_url,
      bank_accounts: payload.vendor.bank_accounts,
    },
    services: payload.services,
    cities: payload.cities,
  });
}
