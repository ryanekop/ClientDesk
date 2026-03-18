"use client";

import { createContext, useContext, type ReactNode } from "react";

export interface ClientTenantConfig {
  id: string;
  slug: string;
  name: string;
  domain: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  footerText: string;
  disableBookingSlug: boolean;
  defaultBookingVendorSlug: string;
}

const DEFAULT_TENANT: ClientTenantConfig = {
  id: "default",
  slug: "clientdesk",
  name: "Client Desk",
  domain: "",
  logoUrl: "/icon-192.png",
  faviconUrl: "",
  primaryColor: "#7c3aed",
  footerText: "",
  disableBookingSlug: false,
  defaultBookingVendorSlug: "",
};

const TenantContext = createContext<ClientTenantConfig>(DEFAULT_TENANT);

export function TenantProvider({
  tenant,
  children,
}: {
  tenant: ClientTenantConfig;
  children: ReactNode;
}) {
  return (
    <TenantContext.Provider value={tenant}>{children}</TenantContext.Provider>
  );
}

export function useTenant(): ClientTenantConfig {
  return useContext(TenantContext);
}
