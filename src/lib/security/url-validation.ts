import { isIP } from "node:net";

function isPrivateIpv4(host: string) {
  const parts = host.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIpv6(host: string) {
  const normalized = host.toLowerCase();
  if (normalized === "::1") return true;
  if (normalized.startsWith("fe80:")) return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  return false;
}

function isPrivateHost(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) return true;

  if (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "0.0.0.0" ||
    normalized === "::1" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal")
  ) {
    return true;
  }

  const ipType = isIP(normalized);
  if (ipType === 4) {
    return isPrivateIpv4(normalized);
  }
  if (ipType === 6) {
    return isPrivateIpv6(normalized);
  }

  return false;
}

export function validateExternalHttpsUrl(
  rawValue: string | null | undefined,
  options?: {
    maxLength?: number;
    allowEmpty?: boolean;
  },
) {
  const maxLength = options?.maxLength ?? 2048;
  const allowEmpty = options?.allowEmpty !== false;
  const value = typeof rawValue === "string" ? rawValue.trim() : "";

  if (!value) {
    return {
      valid: allowEmpty,
      normalizedUrl: null,
      error: allowEmpty ? null : "URL wajib diisi.",
    };
  }

  if (value.length > maxLength) {
    return {
      valid: false,
      normalizedUrl: null,
      error: "URL terlalu panjang (maksimal 2048 karakter).",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return {
      valid: false,
      normalizedUrl: null,
      error: "URL tidak valid.",
    };
  }

  if (parsed.protocol !== "https:") {
    return {
      valid: false,
      normalizedUrl: null,
      error: "URL wajib menggunakan HTTPS.",
    };
  }

  if (parsed.username || parsed.password) {
    return {
      valid: false,
      normalizedUrl: null,
      error: "URL tidak boleh berisi username/password.",
    };
  }

  if (parsed.port && parsed.port !== "443") {
    return {
      valid: false,
      normalizedUrl: null,
      error: "Port URL tidak diizinkan.",
    };
  }

  if (isPrivateHost(parsed.hostname)) {
    return {
      valid: false,
      normalizedUrl: null,
      error: "Host internal/private tidak diizinkan.",
    };
  }

  return {
    valid: true,
    normalizedUrl: parsed.toString(),
    error: null,
  };
}
