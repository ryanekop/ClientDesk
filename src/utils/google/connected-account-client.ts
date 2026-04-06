"use client";

export type ConnectedGoogleAccountServiceState = {
  connected: boolean;
  email: string | null;
  reconnectRequired?: boolean;
  code?: string;
};

export type ConnectedGoogleAccountResponse = {
  calendar: ConnectedGoogleAccountServiceState;
  drive: ConnectedGoogleAccountServiceState;
};

type ConnectedGoogleAccountCacheEntry = {
  payload: ConnectedGoogleAccountResponse;
  fetchedAt: number;
};

export const GOOGLE_CONNECTED_ACCOUNT_CACHE_TTL_MS = 10 * 60 * 1000;

const CONNECTED_ACCOUNT_CACHE_STORAGE_KEY =
  "clientdesk:google-connected-account:v1";

let memoryCache: ConnectedGoogleAccountCacheEntry | null = null;

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeServiceState(
  value: unknown,
): ConnectedGoogleAccountServiceState {
  const service =
    value && typeof value === "object"
      ? (value as {
          connected?: unknown;
          email?: unknown;
          reconnectRequired?: unknown;
          code?: unknown;
        })
      : null;

  return {
    connected: service?.connected === true,
    email: normalizeEmail(service?.email),
    reconnectRequired:
      typeof service?.reconnectRequired === "boolean"
        ? service.reconnectRequired
        : undefined,
    code: typeof service?.code === "string" ? service.code : undefined,
  };
}

function normalizeConnectedAccountPayload(
  value: unknown,
): ConnectedGoogleAccountResponse | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as { calendar?: unknown; drive?: unknown };
  return {
    calendar: normalizeServiceState(payload.calendar),
    drive: normalizeServiceState(payload.drive),
  };
}

function readStorageCache() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(
      CONNECTED_ACCOUNT_CACHE_STORAGE_KEY,
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      payload?: unknown;
      fetchedAt?: unknown;
    };
    const normalized = normalizeConnectedAccountPayload(parsed.payload);
    const fetchedAt =
      typeof parsed.fetchedAt === "number" && Number.isFinite(parsed.fetchedAt)
        ? parsed.fetchedAt
        : 0;
    if (!normalized || fetchedAt <= 0) return null;
    return { payload: normalized, fetchedAt };
  } catch {
    return null;
  }
}

function writeStorageCache(entry: ConnectedGoogleAccountCacheEntry) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      CONNECTED_ACCOUNT_CACHE_STORAGE_KEY,
      JSON.stringify(entry),
    );
  } catch {
    // Ignore storage write failures.
  }
}

function clearStorageCache() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(CONNECTED_ACCOUNT_CACHE_STORAGE_KEY);
  } catch {
    // Ignore storage clear failures.
  }
}

function isFresh(entry: ConnectedGoogleAccountCacheEntry) {
  return Date.now() - entry.fetchedAt <= GOOGLE_CONNECTED_ACCOUNT_CACHE_TTL_MS;
}

function getFreshCache() {
  if (memoryCache && isFresh(memoryCache)) {
    return memoryCache.payload;
  }

  const storageCache = readStorageCache();
  if (storageCache && isFresh(storageCache)) {
    memoryCache = storageCache;
    return storageCache.payload;
  }

  return null;
}

function setCache(payload: ConnectedGoogleAccountResponse) {
  const entry = { payload, fetchedAt: Date.now() };
  memoryCache = entry;
  writeStorageCache(entry);
}

export function clearConnectedGoogleAccountCache() {
  memoryCache = null;
  clearStorageCache();
}

export async function fetchConnectedGoogleAccountStatus(args?: {
  force?: boolean;
}) {
  const force = args?.force === true;
  if (!force) {
    const cached = getFreshCache();
    if (cached) return cached;
  }

  const response = await fetch("/api/google/connected-account", {
    cache: "no-store",
  });
  if (!response.ok) return null;
  const rawPayload = (await response.json().catch(() => null)) as unknown;
  const payload = normalizeConnectedAccountPayload(rawPayload);
  if (!payload) return null;
  setCache(payload);
  return payload;
}
