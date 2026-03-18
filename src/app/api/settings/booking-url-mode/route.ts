import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { invalidateTenantCache, resolveTenant } from "@/lib/tenant-resolver";
import {
  isMainClientDeskDomain,
  normalizeHost,
  normalizeVendorSlug,
} from "@/lib/booking-url-mode";

type ProfileAccess = {
  id: string;
  role: string | null;
  tenant_id: string | null;
  vendor_slug: string | null;
};

function getHostFromRequest(request: NextRequest) {
  return normalizeHost(
    request.headers.get("x-forwarded-host") || request.headers.get("host"),
  );
}

function normalizeRole(value: string | null | undefined) {
  if (!value) return "";
  return value.trim().toLowerCase();
}

async function resolveTenantAndProfile(
  request: NextRequest,
): Promise<
  | {
      error: NextResponse;
    }
  | {
      tenant: Awaited<ReturnType<typeof resolveTenant>>;
      host: string;
      profile: ProfileAccess;
      isMainDomain: boolean;
    }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const host = getHostFromRequest(request);
  const tenant = await resolveTenant(host);
  if (tenant.id === "default") {
    return {
      error: NextResponse.json(
        { error: "Tenant not resolved for current domain." },
        { status: 400 },
      ),
    };
  }

  const service = createServiceClient();
  const { data: profile, error: profileError } = await service
    .from("profiles")
    .select("id, role, tenant_id, vendor_slug")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return {
      error: NextResponse.json(
        { error: "Profile not found." },
        { status: 404 },
      ),
    };
  }

  if (profile.tenant_id !== tenant.id) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return {
    tenant,
    host,
    profile: profile as ProfileAccess,
    isMainDomain: isMainClientDeskDomain(host),
  };
}

export async function GET(request: NextRequest) {
  const resolved = await resolveTenantAndProfile(request);
  if ("error" in resolved) return resolved.error;

  const role = normalizeRole(resolved.profile.role);
  if (role !== "admin" && role !== "staff") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    tenant: {
      id: resolved.tenant.id,
      slug: resolved.tenant.slug,
      domain: resolved.tenant.domain,
      disable_booking_slug: resolved.isMainDomain
        ? false
        : resolved.tenant.disableBookingSlug,
      default_booking_vendor_slug: resolved.tenant.defaultBookingVendorSlug,
    },
    is_main_domain: resolved.isMainDomain,
    role,
  });
}

export async function PUT(request: NextRequest) {
  const resolved = await resolveTenantAndProfile(request);
  if ("error" in resolved) return resolved.error;

  const role = normalizeRole(resolved.profile.role);
  if (role !== "admin") {
    return NextResponse.json(
      { error: "Only admin can update booking URL mode." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const requestedDisable = body.disableBookingSlug === true;
  const requestedDefaultSlug = normalizeVendorSlug(
    typeof body.defaultBookingVendorSlug === "string"
      ? body.defaultBookingVendorSlug
      : "",
  );
  const fallbackProfileSlug = normalizeVendorSlug(resolved.profile.vendor_slug);
  const effectiveDisable = resolved.isMainDomain ? false : requestedDisable;
  const effectiveDefaultSlug = effectiveDisable
    ? requestedDefaultSlug || fallbackProfileSlug || null
    : null;

  const service = createServiceClient();
  if (effectiveDisable) {
    if (!effectiveDefaultSlug) {
      return NextResponse.json(
        {
          error:
            "Default booking vendor slug is required when slugless mode is enabled.",
        },
        { status: 400 },
      );
    }

    const { data: mappedVendor, error: mappedVendorError } = await service
      .from("profiles")
      .select("id")
      .eq("tenant_id", resolved.tenant.id)
      .eq("vendor_slug", effectiveDefaultSlug)
      .maybeSingle();

    if (mappedVendorError) {
      return NextResponse.json(
        {
          error:
            mappedVendorError.message ||
            "Failed to validate default booking vendor slug.",
        },
        { status: 500 },
      );
    }

    if (!mappedVendor) {
      return NextResponse.json(
        {
          error:
            "Default booking vendor slug does not exist in this tenant.",
        },
        { status: 400 },
      );
    }
  }

  const { data: updatedTenant, error: updateError } = await service
    .from("tenants")
    .update({
      disable_booking_slug: effectiveDisable,
      default_booking_vendor_slug: effectiveDefaultSlug,
    })
    .eq("id", resolved.tenant.id)
    .select(
      "id, slug, domain, disable_booking_slug, default_booking_vendor_slug",
    )
    .single();

  if (updateError || !updatedTenant) {
    return NextResponse.json(
      { error: updateError?.message || "Failed to update tenant mode." },
      { status: 500 },
    );
  }

  invalidateTenantCache(resolved.host);
  if (resolved.tenant.domain) {
    invalidateTenantCache(resolved.tenant.domain);
  }

  return NextResponse.json({
    success: true,
    tenant: updatedTenant,
    is_main_domain: resolved.isMainDomain,
  });
}
