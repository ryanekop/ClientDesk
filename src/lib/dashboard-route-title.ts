export type DashboardRouteTitleKey =
  | "appDefault"
  | "dashboard"
  | "tutorial"
  | "comingSoon"
  | "bookings"
  | "createBooking"
  | "editBooking"
  | "bookingDetail"
  | "calendar"
  | "services"
  | "finance"
  | "invoiceSettlement"
  | "team"
  | "formBooking"
  | "formSettlement"
  | "formSpecialBooking"
  | "statusBooking"
  | "changelog"
  | "settings"
  | "profile";

export const DASHBOARD_TITLE_SUFFIX = "Vendor Management";

function normalizePathname(pathname: string): string {
  if (!pathname) return "/";

  const withoutHash = pathname.split("#")[0] || pathname;
  const withoutQuery = withoutHash.split("?")[0] || withoutHash;

  if (withoutQuery.length > 1 && withoutQuery.endsWith("/")) {
    return withoutQuery.slice(0, -1);
  }

  return withoutQuery || "/";
}

export function resolveDashboardRouteTitleKey(pathname: string): DashboardRouteTitleKey {
  const normalizedPath = normalizePathname(pathname);

  // Keep priority explicit for dynamic booking routes.
  if (normalizedPath.startsWith("/bookings/new")) return "createBooking";
  if (/^\/bookings\/[^/]+\/edit(?:\/.*)?$/.test(normalizedPath)) return "editBooking";
  if (/^\/bookings\/[^/]+(?:\/.*)?$/.test(normalizedPath)) return "bookingDetail";

  if (normalizedPath.startsWith("/dashboard")) return "dashboard";
  if (normalizedPath.startsWith("/tutorial")) return "tutorial";
  if (normalizedPath.startsWith("/coming-soon")) return "comingSoon";
  if (normalizedPath.startsWith("/bookings")) return "bookings";
  if (normalizedPath.startsWith("/client-status")) return "statusBooking";
  if (normalizedPath.startsWith("/calendar")) return "calendar";
  if (normalizedPath.startsWith("/services")) return "services";
  if (normalizedPath.startsWith("/finance")) return "finance";
  if (normalizedPath.startsWith("/invoice-pelunasan")) return "invoiceSettlement";
  if (normalizedPath.startsWith("/team")) return "team";
  if (normalizedPath.startsWith("/form-booking")) return "formBooking";
  if (normalizedPath.startsWith("/settlement-form")) return "formSettlement";
  if (normalizedPath.startsWith("/special-booking-form")) return "formSpecialBooking";
  if (normalizedPath.startsWith("/changelog")) return "changelog";
  if (normalizedPath.startsWith("/settings")) return "settings";
  if (normalizedPath.startsWith("/profile")) return "profile";

  return "appDefault";
}

export function resolveDashboardRouteTitle(
  pathname: string,
  translate: (key: DashboardRouteTitleKey) => string,
): string {
  return translate(resolveDashboardRouteTitleKey(pathname));
}

export function buildDashboardDocumentTitle({
  pathname,
  tenantName,
  translate,
}: {
  pathname: string;
  tenantName: string;
  translate: (key: DashboardRouteTitleKey) => string;
}): string {
  const routeTitle = resolveDashboardRouteTitle(pathname, translate);
  const safeTenantName = tenantName.trim() || "Client Desk";
  if (routeTitle.trim().toLowerCase() === safeTenantName.toLowerCase()) {
    return `${safeTenantName} - ${DASHBOARD_TITLE_SUFFIX}`;
  }
  return `${routeTitle} - ${safeTenantName} - ${DASHBOARD_TITLE_SUFFIX}`;
}
