import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  normalizeBankAccounts,
  normalizePaymentMethods,
  resolveDriveImageUrl,
} from "@/lib/payment-config";

interface VendorProfile {
  id: string;
  studio_name: string;
  whatsapp_number: string;
  min_dp_percent: number;
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
  bank_accounts: unknown[] | null;
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json(
      { success: false, error: "slug required" },
      { status: 400 },
    );
  }

  // Fetch only the columns we actually need — no more select("*")
  const { data: vendorRaw, error } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, studio_name, whatsapp_number, min_dp_percent, min_dp_map, " +
        "avatar_url, invoice_logo_url, form_brand_color, form_greeting, " +
        "form_event_types, custom_event_types, form_show_location, form_show_notes, form_show_addons, form_show_proof, " +
        "form_terms_enabled, form_terms_agreement_text, form_terms_link_text, form_terms_suffix_text, form_terms_content, " +
        "form_sections, form_payment_methods, qris_image_url, qris_drive_file_id, bank_accounts",
    )
    .eq("vendor_slug", slug)
    .single();

  const vendor = vendorRaw as VendorProfile | null;

  if (!vendor || error) {
    return NextResponse.json(
      { success: false, error: "Vendor not found" },
      { status: 404 },
    );
  }

  // Fetch services in parallel now that we have vendor.id
  const { data: services } = await supabaseAdmin
    .from("services")
    .select("id, name, price, original_price, description, is_addon, is_public, sort_order")
    .eq("user_id", vendor.id)
    .eq("is_active", true)
    .eq("is_public", true)
    .order("sort_order", { ascending: true })
    .order("name");

  return NextResponse.json(
    {
      success: true,
      vendor: {
        studio_name: vendor.studio_name,
        whatsapp_number: vendor.whatsapp_number,
        min_dp_percent: vendor.min_dp_percent,
        min_dp_map: vendor.min_dp_map || {},
        avatar_url: vendor.avatar_url,
        invoice_logo_url: vendor.invoice_logo_url || null,
        form_brand_color: vendor.form_brand_color || "#000000",
        form_greeting: vendor.form_greeting || null,
        form_event_types: vendor.form_event_types || null,
        custom_event_types: vendor.custom_event_types || [],
        form_show_location: vendor.form_show_location ?? true,
        form_show_notes: vendor.form_show_notes ?? true,
        form_show_addons: vendor.form_show_addons ?? true,
        form_show_proof: vendor.form_show_proof ?? true,
        form_terms_enabled: vendor.form_terms_enabled ?? false,
        form_terms_agreement_text: vendor.form_terms_agreement_text || null,
        form_terms_link_text: vendor.form_terms_link_text || null,
        form_terms_suffix_text: vendor.form_terms_suffix_text || null,
        form_terms_content: vendor.form_terms_content || null,
        form_sections: vendor.form_sections || [],
        form_payment_methods: normalizePaymentMethods(vendor.form_payment_methods),
        qris_image_url: resolveDriveImageUrl(vendor.qris_image_url, vendor.qris_drive_file_id),
        bank_accounts: normalizeBankAccounts(vendor.bank_accounts),
      },
      services: services || [],
    },
    {
      headers: {
        // Cache response di edge for 30s — vendor config jarang berubah
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    },
  );
}
