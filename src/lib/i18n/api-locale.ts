import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";

export type AppLocale = (typeof routing.locales)[number];

function isAppLocale(value: string | null | undefined): value is AppLocale {
  if (!value) return false;
  return routing.locales.includes(value as AppLocale);
}

function normalizeLocaleCandidate(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  if (normalized.includes("-")) {
    return normalized.split("-")[0] || null;
  }

  return normalized;
}

function readLocaleFromReferer(request: NextRequest): string | null {
  const refererHeader = request.headers.get("referer");
  if (!refererHeader) return null;

  try {
    const referer = new URL(refererHeader);
    const firstSegment = referer.pathname.split("/").filter(Boolean)[0] || "";
    return normalizeLocaleCandidate(firstSegment);
  } catch {
    return null;
  }
}

function readLocaleFromAcceptLanguage(request: NextRequest): string | null {
  const acceptLanguage = request.headers.get("accept-language");
  if (!acceptLanguage) return null;

  const firstValue = acceptLanguage.split(",")[0] || "";
  return normalizeLocaleCandidate(firstValue);
}

export function resolveApiLocale(request: NextRequest): AppLocale {
  const fromHeader = normalizeLocaleCandidate(
    request.headers.get("x-client-locale") ||
      request.headers.get("x-locale") ||
      undefined,
  );
  if (isAppLocale(fromHeader)) return fromHeader;

  const fromQuery = normalizeLocaleCandidate(
    request.nextUrl.searchParams.get("locale"),
  );
  if (isAppLocale(fromQuery)) return fromQuery;

  const fromCookie = normalizeLocaleCandidate(
    request.cookies.get("NEXT_LOCALE")?.value ||
      request.cookies.get("__Host-NEXT_LOCALE")?.value ||
      request.cookies.get("locale")?.value,
  );
  if (isAppLocale(fromCookie)) return fromCookie;

  const fromReferer = readLocaleFromReferer(request);
  if (isAppLocale(fromReferer)) return fromReferer;

  const fromAcceptLanguage = readLocaleFromAcceptLanguage(request);
  if (isAppLocale(fromAcceptLanguage)) return fromAcceptLanguage;

  return routing.defaultLocale;
}
