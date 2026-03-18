import { createClient } from "@supabase/supabase-js";

export interface TenantConfig {
  id: string;
  slug: string;
  name: string;
  domain: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  footerText: string | null;
  isActive: boolean;
  disableBookingSlug: boolean;
  defaultBookingVendorSlug: string | null;
}

const DEFAULT_TENANT: TenantConfig = {
  id: "default",
  slug: "clientdesk",
  name: "Client Desk",
  domain: null,
  logoUrl: "/icon-192.png",
  faviconUrl: null,
  primaryColor: null,
  footerText: null,
  isActive: true,
  disableBookingSlug: false,
  defaultBookingVendorSlug: null,
};

const tenantCache = new Map<string, { tenant: TenantConfig; expiry: number }>();
const CACHE_TTL_MS = 5 * 1000;

type ResolveTenantOptions = {
  bypassCache?: boolean;
};

export async function resolveTenant(
  hostname: string,
  options: ResolveTenantOptions = {},
): Promise<TenantConfig> {
  const cleanHost = hostname.split(":")[0].toLowerCase();
  const bypassCache = options.bypassCache === true;
  if (!cleanHost) {
    return DEFAULT_TENANT;
  }

  if (!bypassCache) {
    const cached = tenantCache.get(cleanHost);
    if (cached && Date.now() < cached.expiry) {
      return cached.tenant;
    }
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    let { data, error } = await supabase
      .from("tenants")
      .select(
        "id, slug, name, domain, logo_url, favicon_url, primary_color, footer_text, is_active, disable_booking_slug, default_booking_vendor_slug",
      )
      .eq("domain", cleanHost)
      .eq("is_active", true)
      .single();

    const missingSlugModeColumn = [error?.message, error?.details, error?.hint]
      .filter((value): value is string => Boolean(value))
      .some((message) =>
        /disable_booking_slug|default_booking_vendor_slug/i.test(message),
      );

    if (error && missingSlugModeColumn) {
      const fallbackResult = await supabase
        .from("tenants")
        .select(
          "id, slug, name, domain, logo_url, favicon_url, primary_color, footer_text, is_active",
        )
        .eq("domain", cleanHost)
        .eq("is_active", true)
        .single();
      data = fallbackResult.data
        ? {
            ...fallbackResult.data,
            disable_booking_slug: false,
            default_booking_vendor_slug: null,
          }
        : null;
      error = fallbackResult.error;
    }

    if (data && !error) {
      const tenant: TenantConfig = {
        id: data.id,
        slug: data.slug,
        name: data.name,
        domain: data.domain,
        logoUrl: data.logo_url,
        faviconUrl: data.favicon_url,
        primaryColor: data.primary_color || null,
        footerText: data.footer_text,
        isActive: data.is_active,
        disableBookingSlug: data.disable_booking_slug === true,
        defaultBookingVendorSlug:
          typeof data.default_booking_vendor_slug === "string"
            ? data.default_booking_vendor_slug
            : null,
      };
      if (!bypassCache) {
        tenantCache.set(cleanHost, { tenant, expiry: Date.now() + CACHE_TTL_MS });
      }
      return tenant;
    }
  } catch (error) {
    console.error("[Tenant Resolver] DB lookup failed:", error);
  }

  if (!bypassCache) {
    tenantCache.set(cleanHost, {
      tenant: DEFAULT_TENANT,
      expiry: Date.now() + CACHE_TTL_MS,
    });
  }
  return DEFAULT_TENANT;
}

export function invalidateTenantCache(hostname?: string) {
  if (hostname) {
    tenantCache.delete(hostname.split(":")[0].toLowerCase());
  } else {
    tenantCache.clear();
  }
}
