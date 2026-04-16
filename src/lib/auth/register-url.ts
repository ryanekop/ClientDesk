import {
  MAIN_CLIENTDESK_DOMAIN,
  normalizeHost,
} from "@/lib/booking-url-mode";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function getMainClientDeskOrigin(): string {
  return (
    normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL) ||
    `https://${MAIN_CLIENTDESK_DOMAIN}`
  );
}

export function isLocalHostname(hostname: string | null | undefined): boolean {
  return LOCAL_HOSTNAMES.has(normalizeHost(hostname));
}

export function shouldUseMainClientDeskRegisterOrigin(
  hostname: string | null | undefined,
): boolean {
  const cleanHost = normalizeHost(hostname);
  if (!cleanHost || isLocalHostname(cleanHost)) return false;

  const mainHost = normalizeHost(new URL(getMainClientDeskOrigin()).hostname);
  return cleanHost !== mainHost;
}

export function getClientDeskRegisterHref(locale: string): string {
  const relativeHref = `/${locale}/register`;

  if (typeof window === "undefined") {
    return relativeHref;
  }

  if (!shouldUseMainClientDeskRegisterOrigin(window.location.hostname)) {
    return relativeHref;
  }

  return `${getMainClientDeskOrigin()}${relativeHref}`;
}
