type TenantBrandingContext = {
  id?: string | null;
  domain?: string | null;
};

const BRANDING_EXCEPTION_DOMAINS = new Set([
  "ryanekoapp.web.id",
  "clientdesk.ryanekoapp.web.id",
]);

function normalizeDomain(value: string | null | undefined) {
  if (!value) return "";
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0]
    .replace(/^www\./, "");
  return normalized;
}

export function shouldHideTenantBranding(context: TenantBrandingContext) {
  const tenantId = (context.id || "").trim().toLowerCase();
  if (!tenantId || tenantId === "default") return false;

  const tenantDomain = normalizeDomain(context.domain);
  if (tenantDomain && BRANDING_EXCEPTION_DOMAINS.has(tenantDomain)) {
    return false;
  }

  return true;
}
