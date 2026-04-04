import { createHmac, timingSafeEqual } from "node:crypto";

type InvoiceStage = "initial" | "final";
type InvoiceLang = "id" | "en";

type InvoiceTokenPayload = {
  bookingCode: string;
  stage: InvoiceStage;
  lang: InvoiceLang;
  exp: number;
};

const DEFAULT_INVOICE_TOKEN_EXPIRES_SEC = 60 * 60 * 24 * 30;

function getInvoiceTokenSecret() {
  const raw =
    process.env.INVOICE_ACCESS_TOKEN_SECRET ||
    process.env.GOOGLE_OAUTH_STATE_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  const secret = raw.trim();
  return secret || null;
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

function normalizeStage(value: string | null | undefined): InvoiceStage {
  return value === "final" ? "final" : "initial";
}

function normalizeLang(value: string | null | undefined): InvoiceLang {
  return value === "en" ? "en" : "id";
}

function sign(payloadEncoded: string, secret: string) {
  return createHmac("sha256", secret).update(payloadEncoded).digest("base64url");
}

function safeVerifySignature(payloadEncoded: string, signatureEncoded: string, secret: string) {
  let expectedBuffer: Buffer;
  let actualBuffer: Buffer;

  try {
    expectedBuffer = Buffer.from(sign(payloadEncoded, secret), "base64url");
    actualBuffer = Buffer.from(signatureEncoded, "base64url");
  } catch {
    return false;
  }

  if (expectedBuffer.length === 0 || expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export function createInvoiceAccessToken(args: {
  bookingCode: string;
  stage?: string | null;
  lang?: string | null;
  nowMs?: number;
  expiresInSec?: number;
}) {
  const secret = getInvoiceTokenSecret();
  const bookingCode = (args.bookingCode || "").trim();
  if (!secret || !bookingCode) return null;

  const nowMs = Number.isFinite(args.nowMs) ? Number(args.nowMs) : Date.now();
  const expiresInSec = Math.max(
    60,
    Number.isFinite(args.expiresInSec)
      ? Math.floor(Number(args.expiresInSec))
      : DEFAULT_INVOICE_TOKEN_EXPIRES_SEC,
  );

  const payload: InvoiceTokenPayload = {
    bookingCode,
    stage: normalizeStage(args.stage),
    lang: normalizeLang(args.lang),
    exp: Math.floor(nowMs / 1000) + expiresInSec,
  };

  const payloadEncoded = encodeBase64Url(JSON.stringify(payload));
  const signatureEncoded = sign(payloadEncoded, secret);
  return `${payloadEncoded}.${signatureEncoded}`;
}

export function verifyInvoiceAccessToken(token: string | null | undefined) {
  if (!token || typeof token !== "string") {
    return { valid: false as const, reason: "missing_token" };
  }

  const secret = getInvoiceTokenSecret();
  if (!secret) {
    return { valid: false as const, reason: "missing_secret" };
  }

  const [payloadEncoded, signatureEncoded, extra] = token.split(".");
  if (!payloadEncoded || !signatureEncoded || extra) {
    return { valid: false as const, reason: "invalid_format" };
  }

  if (!safeVerifySignature(payloadEncoded, signatureEncoded, secret)) {
    return { valid: false as const, reason: "invalid_signature" };
  }

  const rawPayload = decodeBase64Url(payloadEncoded);
  if (!rawPayload) {
    return { valid: false as const, reason: "invalid_payload" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawPayload);
  } catch {
    return { valid: false as const, reason: "invalid_payload_json" };
  }

  if (!parsed || typeof parsed !== "object") {
    return { valid: false as const, reason: "invalid_payload_shape" };
  }

  const bookingCode =
    typeof (parsed as { bookingCode?: unknown }).bookingCode === "string"
      ? (parsed as { bookingCode: string }).bookingCode.trim()
      : "";
  const stage = normalizeStage(
    typeof (parsed as { stage?: unknown }).stage === "string"
      ? (parsed as { stage: string }).stage
      : null,
  );
  const lang = normalizeLang(
    typeof (parsed as { lang?: unknown }).lang === "string"
      ? (parsed as { lang: string }).lang
      : null,
  );
  const exp =
    typeof (parsed as { exp?: unknown }).exp === "number"
      ? (parsed as { exp: number }).exp
      : NaN;

  if (!bookingCode || !Number.isFinite(exp)) {
    return { valid: false as const, reason: "invalid_claims" };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec >= exp) {
    return { valid: false as const, reason: "expired_token" };
  }

  return {
    valid: true as const,
    payload: {
      bookingCode,
      stage,
      lang,
      exp,
    },
  };
}

export function buildSignedInvoicePath(args: {
  bookingCode: string;
  stage?: string | null;
  lang?: string | null;
  expiresInSec?: number;
}) {
  const token = createInvoiceAccessToken({
    bookingCode: args.bookingCode,
    stage: args.stage,
    lang: args.lang,
    expiresInSec: args.expiresInSec,
  });

  if (!token) {
    const stage = normalizeStage(args.stage);
    const lang = normalizeLang(args.lang);
    return `/api/public/invoice?code=${encodeURIComponent(args.bookingCode)}&lang=${lang}&stage=${stage}`;
  }

  return `/api/public/invoice?token=${encodeURIComponent(token)}`;
}
