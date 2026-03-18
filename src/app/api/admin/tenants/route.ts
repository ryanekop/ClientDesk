import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { invalidateTenantCache } from "@/lib/tenant-resolver";
import { normalizeVendorSlug } from "@/lib/booking-url-mode";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-admin-api-key",
};

function corsResponse(data: unknown, init?: { status?: number }) {
  return NextResponse.json(data, { ...init, headers: CORS_HEADERS });
}

function verifyAdmin(request: NextRequest) {
  const apiKey = request.headers.get("x-admin-api-key");
  return apiKey && apiKey === process.env.ADMIN_API_KEY;
}

function normalizeBookingModePayload(body: Record<string, unknown>) {
  const hasDisableBookingSlug = Object.prototype.hasOwnProperty.call(
    body,
    "disable_booking_slug",
  );
  const hasDefaultVendorSlug = Object.prototype.hasOwnProperty.call(
    body,
    "default_booking_vendor_slug",
  );

  const normalizedDisableBookingSlug = hasDisableBookingSlug
    ? body.disable_booking_slug === true
    : undefined;
  const normalizedDefaultBookingVendorSlug = hasDefaultVendorSlug
    ? normalizeVendorSlug(
        typeof body.default_booking_vendor_slug === "string"
          ? body.default_booking_vendor_slug
          : "",
      ) || null
    : undefined;

  return {
    hasDisableBookingSlug,
    hasDefaultVendorSlug,
    normalizedDisableBookingSlug,
    normalizedDefaultBookingVendorSlug,
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return corsResponse({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    return corsResponse({ error: error.message }, { status: 500 });
  }

  return corsResponse(data);
}

export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return corsResponse({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    slug,
    name,
    domain,
    logo_url,
    favicon_url,
    primary_color,
    footer_text,
    disable_booking_slug,
    default_booking_vendor_slug,
  } = body;

  if (!slug || !name) {
    return corsResponse({ error: "slug and name are required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("tenants")
    .insert({
      slug,
      name,
      domain: domain || null,
      logo_url: logo_url || null,
      favicon_url: favicon_url || null,
      primary_color: primary_color || "#7c3aed",
      footer_text: footer_text || null,
      disable_booking_slug: disable_booking_slug === true,
      default_booking_vendor_slug:
        normalizeVendorSlug(
          typeof default_booking_vendor_slug === "string"
            ? default_booking_vendor_slug
            : "",
        ) || null,
    })
    .select()
    .single();

  if (error) {
    return corsResponse({ error: error.message }, { status: 500 });
  }

  invalidateTenantCache();
  return corsResponse(data, { status: 201 });
}

export async function PUT(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return corsResponse({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return corsResponse({ error: "id is required" }, { status: 400 });
  }

  const {
    hasDisableBookingSlug,
    hasDefaultVendorSlug,
    normalizedDisableBookingSlug,
    normalizedDefaultBookingVendorSlug,
  } = normalizeBookingModePayload(updates as Record<string, unknown>);

  if (hasDisableBookingSlug) {
    updates.disable_booking_slug = normalizedDisableBookingSlug;
    if (normalizedDisableBookingSlug === false) {
      updates.default_booking_vendor_slug = null;
    }
  }

  if (
    hasDefaultVendorSlug &&
    !(hasDisableBookingSlug && normalizedDisableBookingSlug === false)
  ) {
    updates.default_booking_vendor_slug = normalizedDefaultBookingVendorSlug;
  }

  const supabase = createServiceClient();
  const { data: oldTenant } = await supabase
    .from("tenants")
    .select("domain")
    .eq("id", id)
    .single();

  const { data, error } = await supabase
    .from("tenants")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return corsResponse({ error: error.message }, { status: 500 });
  }

  if (oldTenant?.domain) invalidateTenantCache(oldTenant.domain);
  if (data?.domain) invalidateTenantCache(data.domain);

  return corsResponse(data);
}
