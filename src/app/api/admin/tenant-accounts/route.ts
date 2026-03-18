import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { normalizeVendorSlug } from "@/lib/booking-url-mode";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-admin-api-key",
};

type ProfileAccount = {
  id: string;
  full_name: string | null;
  role: string | null;
  vendor_slug: string | null;
  tenant_id: string | null;
};

type TenantRow = {
  id: string;
  name: string;
  disable_booking_slug?: boolean | null;
  default_booking_vendor_slug?: string | null;
};

function corsResponse(data: unknown, init?: { status?: number }) {
  return NextResponse.json(data, { ...init, headers: CORS_HEADERS });
}

function verifyAdmin(request: NextRequest) {
  const apiKey = request.headers.get("x-admin-api-key");
  return apiKey && apiKey === process.env.ADMIN_API_KEY;
}

async function listAuthUsersEmailById() {
  const supabase = createServiceClient();
  const emailMap = new Map<string, string | null>();
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw error;
    }

    const users = data?.users || [];
    for (const user of users) {
      emailMap.set(user.id, user.email || null);
    }

    if (users.length < 1000) break;
    page += 1;
  }

  return emailMap;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return corsResponse({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const search = request.nextUrl.searchParams.get("search")?.trim() || "";
    const tenantIdFilter = request.nextUrl.searchParams.get("tenant_id") || "";

    let profileQuery = supabase
      .from("profiles")
      .select("id, full_name, role, vendor_slug, tenant_id")
      .order("created_at", { ascending: false })
      .limit(5000);

    if (tenantIdFilter) {
      profileQuery = profileQuery.eq("tenant_id", tenantIdFilter);
    }

    const { data: profiles, error: profileError } = await profileQuery;
    if (profileError) {
      return corsResponse({ error: profileError.message }, { status: 500 });
    }

    const profileRows = (profiles || []) as ProfileAccount[];
    const tenantIds = Array.from(
      new Set(
        profileRows
          .map((profile) => profile.tenant_id)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    let tenantNameMap = new Map<string, string>();
    if (tenantIds.length > 0) {
      const { data: tenants, error: tenantError } = await supabase
        .from("tenants")
        .select("id, name")
        .in("id", tenantIds);

      if (tenantError) {
        return corsResponse({ error: tenantError.message }, { status: 500 });
      }

      tenantNameMap = new Map(
        ((tenants || []) as TenantRow[]).map((tenant) => [tenant.id, tenant.name]),
      );
    }

    const emailMap = await listAuthUsersEmailById();

    const normalizedSearch = search.toLowerCase();
    const accounts = profileRows
      .map((profile) => {
        const tenantName = profile.tenant_id
          ? tenantNameMap.get(profile.tenant_id) || null
          : null;
        const email = emailMap.get(profile.id) || null;
        return {
          id: profile.id,
          full_name: profile.full_name,
          email,
          role: profile.role,
          vendor_slug: profile.vendor_slug,
          tenant_id: profile.tenant_id,
          tenant_name: tenantName,
        };
      })
      .filter((account) => {
        if (!normalizedSearch) return true;
        return (
          (account.full_name || "").toLowerCase().includes(normalizedSearch) ||
          (account.email || "").toLowerCase().includes(normalizedSearch) ||
          (account.vendor_slug || "").toLowerCase().includes(normalizedSearch) ||
          (account.tenant_name || "").toLowerCase().includes(normalizedSearch)
        );
      });

    return corsResponse({ success: true, accounts });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list tenant accounts";
    return corsResponse({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return corsResponse({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const profileId =
      typeof body.profile_id === "string" ? body.profile_id.trim() : "";
    const tenantId =
      typeof body.tenant_id === "string" ? body.tenant_id.trim() : "";

    if (!profileId || !tenantId) {
      return corsResponse(
        { error: "profile_id and tenant_id are required" },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    const { data: targetTenant, error: targetTenantError } = await supabase
      .from("tenants")
      .select("id, name, disable_booking_slug, default_booking_vendor_slug")
      .eq("id", tenantId)
      .maybeSingle();
    if (targetTenantError) {
      return corsResponse({ error: targetTenantError.message }, { status: 500 });
    }
    if (!targetTenant) {
      return corsResponse({ error: "Tenant not found" }, { status: 404 });
    }

    const { data: targetProfile, error: targetProfileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", profileId)
      .maybeSingle();
    if (targetProfileError) {
      return corsResponse({ error: targetProfileError.message }, { status: 500 });
    }
    if (!targetProfile) {
      return corsResponse({ error: "Profile not found" }, { status: 404 });
    }

    const { data: updatedProfile, error: updateError } = await supabase
      .from("profiles")
      .update({ tenant_id: tenantId })
      .eq("id", profileId)
      .select("id, full_name, role, vendor_slug, tenant_id")
      .single();

    if (updateError) {
      return corsResponse({ error: updateError.message }, { status: 500 });
    }

    const sluglessEnabled = targetTenant.disable_booking_slug === true;
    if (sluglessEnabled) {
      const currentDefaultSlug = normalizeVendorSlug(
        targetTenant.default_booking_vendor_slug || "",
      );
      let defaultSlugExists = false;

      if (currentDefaultSlug) {
        const { data: mappedVendor, error: mappedVendorError } = await supabase
          .from("profiles")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("vendor_slug", currentDefaultSlug)
          .maybeSingle();
        if (mappedVendorError) {
          return corsResponse({ error: mappedVendorError.message }, { status: 500 });
        }
        defaultSlugExists = Boolean(mappedVendor);
      }

      if (!defaultSlugExists) {
        let replacementSlug = normalizeVendorSlug(updatedProfile.vendor_slug || "");

        if (!replacementSlug) {
          const { data: firstTenantVendor, error: firstTenantVendorError } =
            await supabase
              .from("profiles")
              .select("vendor_slug")
              .eq("tenant_id", tenantId)
              .not("vendor_slug", "is", null)
              .order("created_at", { ascending: true })
              .limit(1)
              .maybeSingle();

          if (firstTenantVendorError) {
            return corsResponse({ error: firstTenantVendorError.message }, { status: 500 });
          }

          replacementSlug = normalizeVendorSlug(
            firstTenantVendor?.vendor_slug || "",
          );
        }

        const { error: syncDefaultSlugError } = await supabase
          .from("tenants")
          .update({
            default_booking_vendor_slug: replacementSlug || null,
          })
          .eq("id", tenantId);

        if (syncDefaultSlugError) {
          return corsResponse({ error: syncDefaultSlugError.message }, { status: 500 });
        }
      }
    }

    return corsResponse({
      success: true,
      account: {
        ...updatedProfile,
        tenant_name: targetTenant.name,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update tenant account";
    return corsResponse({ error: message }, { status: 500 });
  }
}
