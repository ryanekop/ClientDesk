export type GoogleOAuthService = "calendar" | "drive";

export const GOOGLE_INVALID_GRANT_CODE = "GOOGLE_INVALID_GRANT";

const GOOGLE_INVALID_GRANT_MESSAGE: Record<GoogleOAuthService, string> = {
  calendar:
    "Sesi Google Calendar sudah tidak valid. Silakan hubungkan ulang akun Google Calendar di Pengaturan.",
  drive:
    "Sesi Google Drive sudah tidak valid. Silakan hubungkan ulang akun Google Drive di Pengaturan.",
};

const MAX_WALK_DEPTH = 6;

function normalizeText(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function parseJsonIfPossible(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

function walkStrings(value: unknown, depth: number, seen: WeakSet<object>, out: string[]) {
  if (depth > MAX_WALK_DEPTH || value === null || typeof value === "undefined") {
    return;
  }

  if (typeof value === "string") {
    const normalized = normalizeText(value);
    if (!normalized) return;
    out.push(normalized);
    const parsed = parseJsonIfPossible(normalized);
    if (parsed) {
      walkStrings(parsed, depth + 1, seen, out);
    }
    return;
  }

  if (typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      walkStrings(item, depth + 1, seen, out);
    }
    return;
  }

  for (const [key, item] of Object.entries(value)) {
    out.push(key);
    walkStrings(item, depth + 1, seen, out);
  }
}

function collectErrorStrings(error: unknown) {
  const parts: string[] = [];
  walkStrings(error, 0, new WeakSet<object>(), parts);
  return parts;
}

export function isGoogleInvalidGrantError(error: unknown) {
  const joined = collectErrorStrings(error).join(" ").toLowerCase();
  if (!joined) return false;
  return joined.includes("invalid_grant");
}

export function getGoogleInvalidGrantMessage(service: GoogleOAuthService) {
  return GOOGLE_INVALID_GRANT_MESSAGE[service];
}

export function buildGoogleInvalidGrantPayload(
  service: GoogleOAuthService,
  message?: string,
) {
  return {
    error: message || getGoogleInvalidGrantMessage(service),
    code: GOOGLE_INVALID_GRANT_CODE,
    reconnectRequired: true as const,
  };
}
