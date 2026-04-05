export type AuthLocale = "id" | "en";

const INTERNAL_HOSTNAMES = new Set(["0.0.0.0", "localhost", "127.0.0.1", "::1"]);

function getFirstHeaderValue(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first || null;
}

function normalizeProto(value: string | null): "http" | "https" | null {
  const raw = getFirstHeaderValue(value)?.toLowerCase();
  if (raw === "http" || raw === "https") return raw;
  return null;
}

function toOrigin(candidate: string | null | undefined): string | null {
  if (!candidate) return null;
  try {
    return new URL(candidate).origin;
  } catch {
    return null;
  }
}

function parseOriginAllowlist(rawValue: string | null | undefined) {
  if (!rawValue) return [];
  return rawValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => toOrigin(item))
    .filter((item): item is string => Boolean(item));
}

function isInternalHostname(hostname: string): boolean {
  return INTERNAL_HOSTNAMES.has(hostname.trim().toLowerCase());
}

export function normalizeAuthLocale(value: string | null | undefined): AuthLocale {
  const locale = (value || "").trim().toLowerCase();
  return locale === "en" ? "en" : "id";
}

export function resolveSafeNextPath(nextPath: string | null | undefined, locale: AuthLocale): string {
  const fallback = `/${locale}/dashboard`;
  const raw = (nextPath || "").trim();
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  return raw;
}

export function getRequestHostname(request: Request): string {
  const forwarded = getFirstHeaderValue(request.headers.get("x-forwarded-host"));
  const hostHeader = forwarded || getFirstHeaderValue(request.headers.get("host")) || "";
  return hostHeader.split(":")[0]?.trim().toLowerCase() || "";
}

export function resolvePublicOrigin(request: Request): string {
  const requestUrl = new URL(request.url);
  const forwardedHost = getFirstHeaderValue(request.headers.get("x-forwarded-host"));
  const forwardedProto = normalizeProto(request.headers.get("x-forwarded-proto"));
  const hostHeader = getFirstHeaderValue(request.headers.get("host"));
  const envSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const inProduction = process.env.NODE_ENV === "production";
  const configuredAllowlistedOrigins = parseOriginAllowlist(
    process.env.PUBLIC_ORIGIN_ALLOWLIST,
  );
  const hasExplicitOriginAllowlist = configuredAllowlistedOrigins.length > 0;
  const allowlistedOrigins = new Set<string>(configuredAllowlistedOrigins);

  const fallbackProtocol =
    requestUrl.protocol === "https:" || requestUrl.protocol === "http:"
      ? requestUrl.protocol.slice(0, -1)
      : "https";

  const candidates: Array<string | null | undefined> = [
    forwardedHost ? `${forwardedProto || "https"}://${forwardedHost}` : null,
    hostHeader ? `${forwardedProto || fallbackProtocol}://${hostHeader}` : null,
    requestUrl.origin,
    envSiteUrl,
  ];

  for (const candidate of candidates) {
    const origin = toOrigin(candidate);
    if (!origin) continue;

    if (inProduction) {
      const hostname = new URL(origin).hostname;
      if (isInternalHostname(hostname)) continue;
      if (hasExplicitOriginAllowlist && !allowlistedOrigins.has(origin)) {
        continue;
      }
    }

    return origin;
  }

  const envOrigin = toOrigin(envSiteUrl);
  if (envOrigin) return envOrigin;
  return requestUrl.origin;
}
