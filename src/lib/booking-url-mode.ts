export const MAIN_CLIENTDESK_DOMAIN = "clientdesk.ryanekoapp.web.id";

export function normalizeHost(hostname: string | null | undefined): string {
  if (!hostname) return "";
  const first = hostname.split(",")[0]?.trim() || "";
  const withoutPort = first.split(":")[0] || "";
  return withoutPort.trim().toLowerCase();
}

export function isMainClientDeskDomain(hostname: string | null | undefined): boolean {
  return normalizeHost(hostname) === MAIN_CLIENTDESK_DOMAIN;
}

export function normalizeVendorSlug(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
