"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "@/i18n/routing";
import { useTenant } from "@/lib/tenant-context";
import { buildDashboardDocumentTitle } from "@/lib/dashboard-route-title";

export function DashboardTitleSync() {
  const pathname = usePathname();
  const locale = useLocale();
  const tenant = useTenant();
  const t = useTranslations("DashboardTitle");

  const nextTitle = buildDashboardDocumentTitle({
    pathname,
    tenantName: tenant.name,
    translate: t,
  });

  React.useEffect(() => {
    document.title = nextTitle;
  }, [locale, nextTitle]);

  return null;
}
