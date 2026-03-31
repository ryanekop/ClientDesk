import { createHmac, timingSafeEqual } from "node:crypto";

export type GoogleOAuthService = "calendar" | "drive";

type GoogleOAuthStatePayload = {
  userId: string;
  service: GoogleOAuthService;
  origin: string | null;
  returnPath: string;
  issuedAt: number;
};

type VerifyGoogleOAuthStateResult =
  | { valid: true; payload: GoogleOAuthStatePayload }
  | { valid: false; reason: string };

const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;
const OAUTH_STATE_ALLOWED_CLOCK_SKEW_MS = 60 * 1000;
const DEFAULT_RETURN_PATH = "/id/settings";
const SETTINGS_PATH_PATTERN = /^\/(id|en)\/settings(?:\/.*)?$/i;

function getGoogleOAuthStateSecret() {
  const raw =
    process.env.GOOGLE_OAUTH_STATE_SECRET ||
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

function signPayload(
  payloadEncoded: string,
  secret: string,
) {
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

export function sanitizeGoogleOAuthOrigin(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

export function sanitizeGoogleOAuthReturnPath(
  value: unknown,
) {
  if (typeof value !== "string") return DEFAULT_RETURN_PATH;
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_RETURN_PATH;
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return DEFAULT_RETURN_PATH;
  }

  try {
    const parsed = new URL(trimmed, "http://localhost");
    if (!SETTINGS_PATH_PATTERN.test(parsed.pathname)) {
      return DEFAULT_RETURN_PATH;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return DEFAULT_RETURN_PATH;
  }
}

export function createSignedGoogleOAuthState(args: {
  userId: string;
  service: GoogleOAuthService;
  origin: string | null;
  returnPath: string;
  issuedAt?: number;
}) {
  const secret = getGoogleOAuthStateSecret();
  const normalizedUserId =
    typeof args.userId === "string" ? args.userId.trim() : "";

  if (!secret || !normalizedUserId) return null;

  const payload: GoogleOAuthStatePayload = {
    userId: normalizedUserId,
    service: args.service,
    origin: sanitizeGoogleOAuthOrigin(args.origin),
    returnPath: sanitizeGoogleOAuthReturnPath(args.returnPath),
    issuedAt: Number.isFinite(args.issuedAt)
      ? Number(args.issuedAt)
      : Date.now(),
  };

  const payloadEncoded = encodeBase64Url(JSON.stringify(payload));
  const signatureEncoded = signPayload(payloadEncoded, secret);
  return `${payloadEncoded}.${signatureEncoded}`;
}

export function verifySignedGoogleOAuthState(
  state: string | null | undefined,
  expectedService: GoogleOAuthService,
): VerifyGoogleOAuthStateResult {
  if (!state || typeof state !== "string") {
    return { valid: false, reason: "missing_state" };
  }

  const secret = getGoogleOAuthStateSecret();
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

  const userId =
    typeof (parsed as { userId?: unknown }).userId === "string"
      ? (parsed as { userId: string }).userId.trim()
      : "";
  const service =
    typeof (parsed as { service?: unknown }).service === "string"
      ? (parsed as { service: string }).service.trim()
      : "";
  const issuedAtRaw = (parsed as { issuedAt?: unknown }).issuedAt;
  const issuedAt =
    typeof issuedAtRaw === "number" && Number.isFinite(issuedAtRaw)
      ? issuedAtRaw
      : NaN;

  if (!userId || (service !== "calendar" && service !== "drive")) {
    return { valid: false, reason: "invalid_state_claims" };
  }
  if (service !== expectedService) {
    return { valid: false, reason: "state_service_mismatch" };
  }
  if (!Number.isFinite(issuedAt)) {
    return { valid: false, reason: "invalid_state_timestamp" };
  }

  const now = Date.now();
  if (
    now - issuedAt > OAUTH_STATE_MAX_AGE_MS ||
    issuedAt - now > OAUTH_STATE_ALLOWED_CLOCK_SKEW_MS
  ) {
    return { valid: false, reason: "expired_state" };
  }

  const payload: GoogleOAuthStatePayload = {
    userId,
    service,
    origin: sanitizeGoogleOAuthOrigin(
      (parsed as { origin?: unknown }).origin,
    ),
    returnPath: sanitizeGoogleOAuthReturnPath(
      (parsed as { returnPath?: unknown }).returnPath,
    ),
    issuedAt,
  };

  return { valid: true, payload };
}

export function buildGoogleOAuthReturnUrl(args: {
  origin: string | null;
  returnPath: string;
  service: GoogleOAuthService;
  status: "success" | "error";
  error?: string | null;
}) {
  const resultCode = `${args.service}_${args.status}`;
  const normalizedReturnPath = sanitizeGoogleOAuthReturnPath(args.returnPath);
  const normalizedOrigin =
    sanitizeGoogleOAuthOrigin(args.origin) ||
    sanitizeGoogleOAuthOrigin(process.env.NEXT_PUBLIC_SITE_URL || "") ||
    null;

  const target = normalizedOrigin
    ? new URL(normalizedReturnPath, normalizedOrigin)
    : new URL(normalizedReturnPath, "http://localhost");
  target.searchParams.set("google_oauth", resultCode);
  if (args.error) {
    target.searchParams.set("error", args.error);
  } else {
    target.searchParams.delete("error");
  }

  if (normalizedOrigin) {
    return target.toString();
  }

  return `${target.pathname}${target.search}${target.hash}`;
}
