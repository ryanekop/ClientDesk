import { createHmac, timingSafeEqual } from "node:crypto";
import { MAIN_CLIENTDESK_DOMAIN, normalizeHost } from "@/lib/booking-url-mode";
import { resolveTenant } from "@/lib/tenant-resolver";
import { normalizeAuthLocale, type AuthLocale } from "@/lib/auth/public-origin";
import { isLocalHostname } from "@/lib/auth/register-url";

export type AuthHandoffPayload = {
  origin: string;
  returnPath: string;
  locale: AuthLocale;
  issuedAt: number;
};

type VerifyAuthHandoffResult =
  | { valid: true; payload: AuthHandoffPayload }
  | { valid: false; reason: string };

const AUTH_HANDOFF_MAX_AGE_MS = 10 * 60 * 1000;
const AUTH_HANDOFF_ALLOWED_CLOCK_SKEW_MS = 60 * 1000;

function getAuthHandoffSecret() {
  const raw =
    process.env.AUTH_HANDOFF_STATE_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

function signPayload(payloadEncoded: string, secret: string) {
  return createHmac("sha256", secret)
    .update(payloadEncoded)
    .digest("base64url");
}

function verifySignature(
  payloadEncoded: string,
  signatureEncoded: string,
  secret: string,
) {
  let actual: Buffer;
  let expected: Buffer;

  try {
    actual = Buffer.from(signatureEncoded, "base64url");
    expected = Buffer.from(signPayload(payloadEncoded, secret), "base64url");
  } catch {
    return false;
  }

  if (actual.length === 0 || actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

export function sanitizeAuthHandoffReturnPath(
  value: string | null | undefined,
  locale: AuthLocale,
) {
  const fallback = `/${locale}/dashboard`;
  const raw = (value || "").trim();
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;

  try {
    const parsed = new URL(raw, "http://localhost");
    if (parsed.pathname === "/auth/callback") return fallback;
    if (parsed.pathname.endsWith("/auth/callback")) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function sanitizeAuthHandoffOrigin(value: string | null | undefined) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

async function isAllowedAuthHandoffOrigin(origin: string) {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }

  const hostname = normalizeHost(parsed.hostname);
  if (!hostname) return false;
  if (hostname === MAIN_CLIENTDESK_DOMAIN) return true;
  if (isLocalHostname(hostname)) return true;

  const tenant = await resolveTenant(hostname, { bypassCache: true });
  return tenant.id !== "default" && normalizeHost(tenant.domain) === hostname;
}

export function createSignedAuthHandoffState(args: {
  origin: string;
  returnPath: string | null | undefined;
  locale: string | null | undefined;
  issuedAt?: number;
}) {
  const secret = getAuthHandoffSecret();
  const origin = sanitizeAuthHandoffOrigin(args.origin);
  const locale = normalizeAuthLocale(args.locale);

  if (!secret || !origin) return null;

  const payload: AuthHandoffPayload = {
    origin,
    returnPath: sanitizeAuthHandoffReturnPath(args.returnPath, locale),
    locale,
    issuedAt: Number.isFinite(args.issuedAt)
      ? Number(args.issuedAt)
      : Date.now(),
  };

  const payloadEncoded = encodeBase64Url(JSON.stringify(payload));
  const signatureEncoded = signPayload(payloadEncoded, secret);
  return `${payloadEncoded}.${signatureEncoded}`;
}

export async function verifySignedAuthHandoffState(
  state: string | null | undefined,
): Promise<VerifyAuthHandoffResult> {
  if (!state || typeof state !== "string") {
    return { valid: false, reason: "missing_state" };
  }

  const secret = getAuthHandoffSecret();
  if (!secret) {
    return { valid: false, reason: "missing_secret" };
  }

  const [payloadEncoded, signatureEncoded, extra] = state.split(".");
  if (!payloadEncoded || !signatureEncoded || extra) {
    return { valid: false, reason: "invalid_state_format" };
  }

  if (!verifySignature(payloadEncoded, signatureEncoded, secret)) {
    return { valid: false, reason: "invalid_state_signature" };
  }

  const decodedPayload = decodeBase64Url(payloadEncoded);
  if (!decodedPayload) {
    return { valid: false, reason: "invalid_state_payload" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decodedPayload);
  } catch {
    return { valid: false, reason: "invalid_state_json" };
  }

  if (!parsed || typeof parsed !== "object") {
    return { valid: false, reason: "invalid_state_shape" };
  }

  const rawOrigin = (parsed as { origin?: unknown }).origin;
  const origin = sanitizeAuthHandoffOrigin(
    typeof rawOrigin === "string" ? rawOrigin : null,
  );
  const locale = normalizeAuthLocale(
    typeof (parsed as { locale?: unknown }).locale === "string"
      ? (parsed as { locale: string }).locale
      : null,
  );
  const returnPath = sanitizeAuthHandoffReturnPath(
    typeof (parsed as { returnPath?: unknown }).returnPath === "string"
      ? (parsed as { returnPath: string }).returnPath
      : null,
    locale,
  );
  const issuedAtRaw = (parsed as { issuedAt?: unknown }).issuedAt;
  const issuedAt =
    typeof issuedAtRaw === "number" && Number.isFinite(issuedAtRaw)
      ? issuedAtRaw
      : NaN;

  if (!origin || !Number.isFinite(issuedAt)) {
    return { valid: false, reason: "invalid_state_claims" };
  }

  const now = Date.now();
  if (
    now - issuedAt > AUTH_HANDOFF_MAX_AGE_MS ||
    issuedAt - now > AUTH_HANDOFF_ALLOWED_CLOCK_SKEW_MS
  ) {
    return { valid: false, reason: "expired_state" };
  }

  if (!(await isAllowedAuthHandoffOrigin(origin))) {
    return { valid: false, reason: "origin_not_allowed" };
  }

  return {
    valid: true,
    payload: {
      origin,
      returnPath,
      locale,
      issuedAt,
    },
  };
}
