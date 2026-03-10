import { createClient } from "@supabase/supabase-js";
import {
  BookingFormClient,
  type Vendor,
  type Service,
} from "./booking-form-client";
import type { Metadata } from "next";

type RawVendor = {
  id: string;
  studio_name: string | null;
  whatsapp_number: string | null;
  min_dp_percent: number | null;
  min_dp_map: Record<string, number> | null;
  avatar_url: string | null;
  invoice_logo_url: string | null;
  form_brand_color: string | null;
  form_greeting: string | null;
  form_event_types: string[] | null;
  form_show_location: boolean | null;
  form_show_notes: boolean | null;
  form_show_proof: boolean | null;
  bank_accounts: Vendor["bank_accounts"] | null;
};

// Admin client — runs server-side only, never exposed to browser
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface PageProps {
  params: Promise<{ vendorSlug: string; locale: string }>;
}

// ── Dynamic metadata for SEO & link previews ──────────────────────────────────
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { vendorSlug } = await params;

  const { data: vendor } = (await supabaseAdmin
    .from("profiles")
    .select("studio_name, form_greeting")
    .eq("vendor_slug", vendorSlug)
    .single()) as {
    data: Pick<RawVendor, "studio_name" | "form_greeting"> | null;
    error: unknown;
  };

  if (!vendor) {
    return { title: "Form Booking" };
  }

  return {
    title: `Form Booking — ${vendor.studio_name || "Studio"}`,
    description:
      vendor.form_greeting ||
      `Booking sesi foto bersama ${vendor.studio_name || "Studio"}.`,
  };
}

// ── Page — Server Component ───────────────────────────────────────────────────
// Data di-fetch langsung di server, bukan di client lewat useEffect.
// Hasilnya: form langsung tampil tanpa loading spinner, tanpa extra round-trip.
export default async function PublicBookingFormPage({ params }: PageProps) {
  const { vendorSlug } = await params;

  // Fetch vendor data server-side (no useEffect, no API route needed for initial load)
  const { data: vendor } = (await supabaseAdmin
    .from("profiles")
    .select(
      "id, studio_name, whatsapp_number, min_dp_percent, min_dp_map, " +
        "avatar_url, invoice_logo_url, form_brand_color, form_greeting, " +
        "form_event_types, form_show_location, form_show_notes, form_show_proof, " +
        "bank_accounts",
    )
    .eq("vendor_slug", vendorSlug)
    .single()) as { data: RawVendor | null; error: unknown };

  // Vendor tidak ditemukan — render langsung di server, tidak perlu client state
  if (!vendor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
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

  // Fetch services — bisa paralel karena kita sudah punya vendor.id dari query di atas
  const { data: services } = (await supabaseAdmin
    .from("services")
    .select("id, name, price, description")
    .eq("user_id", vendor.id)
    .order("name")) as { data: Service[] | null; error: unknown };

  // Normalise tipe agar cocok dengan Vendor type di client component
  const vendorData: Vendor = {
    id: vendor.id,
    studio_name: vendor.studio_name ?? null,
    whatsapp_number: vendor.whatsapp_number ?? null,
    min_dp_percent: vendor.min_dp_percent ?? null,
    min_dp_map: (vendor.min_dp_map as Record<string, number> | null) ?? null,
    avatar_url: vendor.avatar_url ?? null,
    invoice_logo_url: vendor.invoice_logo_url ?? null,
    form_brand_color: vendor.form_brand_color ?? "#000000",
    form_greeting: vendor.form_greeting ?? null,
    form_event_types: (vendor.form_event_types as string[] | null) ?? null,
    form_show_location: vendor.form_show_location ?? true,
    form_show_notes: vendor.form_show_notes ?? true,
    form_show_proof: vendor.form_show_proof ?? true,
    bank_accounts: (vendor.bank_accounts as Vendor["bank_accounts"]) ?? [],
  };

  // Render form — data sudah tersedia, langsung tampil tanpa loading
  return (
    <BookingFormClient
      vendor={vendorData}
      services={(services ?? []) as Service[]}
    />
  );
}
