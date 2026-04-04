import { NextRequest, NextResponse } from "next/server";

import { securityErrorResponse } from "@/lib/security/error-response";
import { getRequestIp } from "@/lib/security/request-ip";

type BucketRecord = {
  count: number;
  resetAt: number;
};

const RATE_LIMIT_BUCKETS = new Map<string, BucketRecord>();
const SWEEP_INTERVAL_MS = 60_000;
let lastSweepAt = 0;

function sweepStaleBuckets(now: number) {
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) return;
  lastSweepAt = now;

  RATE_LIMIT_BUCKETS.forEach((value, key) => {
    if (value.resetAt <= now) {
      RATE_LIMIT_BUCKETS.delete(key);
    }
  });
}

export function enforceRateLimit(args: {
  request: NextRequest;
  namespace: string;
  maxRequests: number;
  windowMs: number;
  message?: string;
}) {
  const now = Date.now();
  sweepStaleBuckets(now);

  const ip = getRequestIp(args.request);
  const key = `${args.namespace}:${ip}`;
  const existing = RATE_LIMIT_BUCKETS.get(key);

  if (!existing || existing.resetAt <= now) {
    RATE_LIMIT_BUCKETS.set(key, {
      count: 1,
      resetAt: now + args.windowMs,
    });
    return null;
  }

  if (existing.count >= args.maxRequests) {
    const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return securityErrorResponse({
      message: args.message || "Terlalu banyak permintaan. Silakan coba lagi beberapa saat.",
      code: "RATE_LIMITED",
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
      },
    });
  }

  existing.count += 1;
  RATE_LIMIT_BUCKETS.set(key, existing);
  return null;
}

export function withNoStoreHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}
