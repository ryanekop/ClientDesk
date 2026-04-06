"use client";

import * as React from "react";

const REPORT_ENDPOINT = "/api/public/client-errors";
const MAX_REPORTS_PER_PAGE = 10;

type ClientErrorPayload = {
  kind: "window_error" | "unhandled_rejection";
  message: string;
  fileName: string | null;
  line: number | null;
  column: number | null;
  stack: string | null;
  reason: string | null;
  path: string;
  userAgent: string;
  timestamp: string;
};

function clampString(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function normalizeUnknownReason(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return clampString(value, 1200);

  if (value instanceof Error) {
    const joined = `${value.name}: ${value.message}`;
    return clampString(joined, 1200);
  }

  try {
    return clampString(JSON.stringify(value), 1200);
  } catch {
    return clampString(String(value), 1200);
  }
}

function sendErrorReport(payload: ClientErrorPayload) {
  const body = JSON.stringify(payload);
  const blob = new Blob([body], { type: "application/json" });

  try {
    if (navigator.sendBeacon(REPORT_ENDPOINT, blob)) {
      return;
    }
  } catch {
    // Fall back to fetch keepalive below.
  }

  void fetch(REPORT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Intentionally swallowed; this is best-effort telemetry.
  });
}

export function ClientErrorObserver() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;

    let sentCount = 0;
    const seenSignatures = new Set<string>();

    const report = (payload: Omit<ClientErrorPayload, "path" | "userAgent" | "timestamp">) => {
      if (sentCount >= MAX_REPORTS_PER_PAGE) return;

      const signature = `${payload.kind}|${payload.message}|${payload.fileName ?? ""}|${payload.line ?? 0}|${payload.column ?? 0}`;
      if (seenSignatures.has(signature)) return;
      seenSignatures.add(signature);
      sentCount += 1;

      sendErrorReport({
        ...payload,
        path: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      });
    };

    const onWindowError = (event: ErrorEvent) => {
      report({
        kind: "window_error",
        message: clampString(event.message || "Script error", 800),
        fileName: event.filename ? clampString(event.filename, 500) : null,
        line: Number.isFinite(event.lineno) ? event.lineno : null,
        column: Number.isFinite(event.colno) ? event.colno : null,
        stack:
          event.error && typeof event.error.stack === "string"
            ? clampString(event.error.stack, 1600)
            : null,
        reason: null,
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const normalizedReason = normalizeUnknownReason(event.reason);
      report({
        kind: "unhandled_rejection",
        message: clampString(normalizedReason || "Unhandled promise rejection", 800),
        fileName: null,
        line: null,
        column: null,
        stack:
          event.reason instanceof Error && typeof event.reason.stack === "string"
            ? clampString(event.reason.stack, 1600)
            : null,
        reason: normalizedReason,
      });
    };

    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
