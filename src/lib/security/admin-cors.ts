import { NextRequest } from "next/server";

const DEFAULT_ALLOWED_HEADERS = "Content-Type, x-admin-api-key";

function parseAllowedOriginsFromEnv() {
  const raw = process.env.ADMIN_API_ALLOWED_ORIGINS || "";
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function resolveAllowedOrigin(request: NextRequest) {
  const requestOrigin = request.headers.get("origin");
  if (!requestOrigin) return null;

  const normalizedRequestOrigin = normalizeOrigin(requestOrigin);
  if (!normalizedRequestOrigin) return null;

  const allowlist = parseAllowedOriginsFromEnv()
    .map((origin) => normalizeOrigin(origin))
    .filter((origin): origin is string => Boolean(origin));
  const currentOrigin = normalizeOrigin(request.nextUrl.origin);

  const effectiveAllowlist = new Set<string>(allowlist);
  if (currentOrigin) {
    effectiveAllowlist.add(currentOrigin);
  }

  if (effectiveAllowlist.has(normalizedRequestOrigin)) {
    return normalizedRequestOrigin;
  }

  return null;
}

export function buildAdminCorsHeaders(request: NextRequest, methods: string) {
  const headers: HeadersInit = {
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": DEFAULT_ALLOWED_HEADERS,
    Vary: "Origin",
  };

  const allowedOrigin = resolveAllowedOrigin(request);
  if (allowedOrigin) {
    headers["Access-Control-Allow-Origin"] = allowedOrigin;
  }

  return headers;
}

export function isAdminCorsOriginAllowed(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return Boolean(resolveAllowedOrigin(request));
}
