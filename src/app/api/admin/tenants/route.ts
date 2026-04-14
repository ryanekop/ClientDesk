import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { invalidateTenantCache } from "@/lib/tenant-resolver";
import { normalizeVendorSlug } from "@/lib/booking-url-mode";
import { invalidatePublicCachesForProfile } from "@/lib/public-cache-invalidation";
import { buildAdminCorsHeaders, isAdminCorsOriginAllowed } from "@/lib/security/admin-cors";
import { sanitizeTenantFooterHtml } from "@/utils/tenant-footer";

const ADMIN_CORS_METHODS = "GET, POST, PUT, DELETE, OPTIONS";

function corsResponse(request: NextRequest, data: unknown, init?: { status?: number }) {
  return NextResponse.json(data, {
    ...init,
    headers: buildAdminCorsHeaders(request, ADMIN_CORS_METHODS),
  });
}

function verifyAdmin(request: NextRequest) {
  const apiKey = request.headers.get("x-admin-api-key");
  const isValid = Boolean(apiKey && apiKey === process.env.ADMIN_API_KEY);
  if (!isValid) {
    const ip = request.headers.get("cf-connecting-ip")
      || request.headers.get("x-forwarded-for")
      || request.headers.get("x-real-ip")
      || "unknown";
    console.warn(`[Admin API] Unauthorized access attempt on ${request.nextUrl.pathname} from ${ip}`);
  }
  return isValid;
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

export async function OPTIONS(request: NextRequest) {
  if (!isAdminCorsOriginAllowed(request)) {
    return NextResponse.json(
      { error: "Origin not allowed" },
      { status: 403, headers: buildAdminCorsHeaders(request, ADMIN_CORS_METHODS) },
    );
  }

  return new NextResponse(null, {
    status: 204,
    headers: buildAdminCorsHeaders(request, ADMIN_CORS_METHODS),
  });
}

export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return corsResponse(request, { error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    return corsResponse(request, { error: error.message }, { status: 500 });
  }

  return corsResponse(request, data);
}

export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return corsResponse(request, { error: "Unauthorized" }, { status: 401 });
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
    return corsResponse(request, { error: "slug and name are required" }, { status: 400 });
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
      footer_text: sanitizeTenantFooterHtml(typeof footer_text === "string" ? footer_text : null),
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
    return corsResponse(request, { error: error.message }, { status: 500 });
  }

  invalidateTenantCache();
  return corsResponse(request, data, { status: 201 });
}

export async function PUT(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return corsResponse(request, { error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return corsResponse(request, { error: "id is required" }, { status: 400 });
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

  if (Object.prototype.hasOwnProperty.call(updates, "footer_text")) {
    updates.footer_text = sanitizeTenantFooterHtml(
      typeof updates.footer_text === "string" ? updates.footer_text : null,
    );
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
    return corsResponse(request, { error: error.message }, { status: 500 });
  }

  if (oldTenant?.domain) invalidateTenantCache(oldTenant.domain);
  if (data?.domain) invalidateTenantCache(data.domain);

  return corsResponse(request, data);
}

export async function DELETE(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return corsResponse(request, { error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const tenantId = typeof body.id === "string" ? body.id.trim() : "";

    if (!tenantId) {
      return corsResponse(request, { error: "id is required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id, domain")
      .eq("id", tenantId)
      .maybeSingle();

    if (tenantError) {
      return corsResponse(request, { error: tenantError.message }, { status: 500 });
    }

    if (!tenant) {
      return corsResponse(request, { error: "Tenant not found" }, { status: 404 });
    }

    const { data: linkedProfiles, error: linkedProfilesError } = await supabase
      .from("profiles")
      .select("id, vendor_slug")
      .eq("tenant_id", tenantId);

    if (linkedProfilesError) {
      return corsResponse(request, { error: linkedProfilesError.message }, { status: 500 });
    }

    const unassignedProfiles = (linkedProfiles || []) as Array<{
      id: string;
      vendor_slug: string | null;
    }>;

    if (unassignedProfiles.length > 0) {
      const { error: unassignError } = await supabase
        .from("profiles")
        .update({ tenant_id: null })
        .eq("tenant_id", tenantId);

      if (unassignError) {
        return corsResponse(request, { error: unassignError.message }, { status: 500 });
      }
    }

    const { error: deleteError } = await supabase
      .from("tenants")
      .delete()
      .eq("id", tenantId);

    if (deleteError) {
      return corsResponse(request, { error: deleteError.message }, { status: 500 });
    }

    if (tenant.domain) {
      invalidateTenantCache(tenant.domain);
    } else {
      invalidateTenantCache();
    }

    for (const profile of unassignedProfiles) {
      invalidatePublicCachesForProfile({
        userId: profile.id,
        vendorSlug: profile.vendor_slug,
      });
    }

    return corsResponse(request, {
      success: true,
      deletedTenantId: tenantId,
      unassignedAccounts: unassignedProfiles.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete tenant";
    return corsResponse(request, { error: message }, { status: 500 });
  }
}
