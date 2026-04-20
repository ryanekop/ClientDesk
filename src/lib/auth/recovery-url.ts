import { normalizeAuthLocale } from "@/lib/auth/public-origin";
import {
  getMainClientDeskOrigin,
  isLocalHostname,
} from "@/lib/auth/register-url";

export function getClientDeskRecoveryCallbackUrl(locale: string): string {
  const normalizedLocale = normalizeAuthLocale(locale);
  const relativePath = `/${normalizedLocale}/auth/callback?type=recovery`;

  if (
    typeof window !== "undefined" &&
    isLocalHostname(window.location.hostname)
  ) {
    return `${window.location.origin}${relativePath}`;
  }

  return `${getMainClientDeskOrigin()}${relativePath}`;
}
