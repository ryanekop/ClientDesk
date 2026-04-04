import { headers } from "next/headers";
import { sanitizeTenantFooterHtml } from "@/utils/tenant-footer";

export interface TenantConfig {
  id: string;
  slug: string;
  name: string;
  domain: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  footerText: string | null;
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
  primaryColor: "#7c3aed",
  footerText: null,
  disableBookingSlug: false,
  defaultBookingVendorSlug: null,
};

export async function getTenantConfig(): Promise<TenantConfig> {
  const headersList = await headers();

  const id = headersList.get("x-tenant-id");
  if (!id || id === "default") {
    return DEFAULT_TENANT;
  }

  return {
    id,
    slug: headersList.get("x-tenant-slug") || "clientdesk",
    name: headersList.get("x-tenant-name") || "Client Desk",
    domain: headersList.get("x-tenant-domain"),
    logoUrl: headersList.get("x-tenant-logo") || "/icon-192.png",
    faviconUrl: headersList.get("x-tenant-favicon"),
    primaryColor: headersList.get("x-tenant-color") || "#7c3aed",
    footerText: sanitizeTenantFooterHtml(headersList.get("x-tenant-footer")),
    disableBookingSlug:
      headersList.get("x-tenant-disable-booking-slug") === "true",
    defaultBookingVendorSlug:
      headersList.get("x-tenant-default-booking-vendor-slug") || null,
  };
}
