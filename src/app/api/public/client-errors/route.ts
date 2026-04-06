import { NextRequest, NextResponse } from "next/server";

function sanitizeString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function sanitizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;

    const sanitized = {
      kind: sanitizeString(payload.kind, 64),
      message: sanitizeString(payload.message, 800),
      fileName: sanitizeString(payload.fileName, 500),
      line: sanitizeNumber(payload.line),
      column: sanitizeNumber(payload.column),
      stack: sanitizeString(payload.stack, 1600),
      reason: sanitizeString(payload.reason, 1200),
      path: sanitizeString(payload.path, 600),
      userAgent: sanitizeString(payload.userAgent, 500),
      timestamp: sanitizeString(payload.timestamp, 64),
      referrer: sanitizeString(request.headers.get("referer"), 600),
      ip:
        sanitizeString(request.headers.get("cf-connecting-ip"), 64) ||
        sanitizeString(
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
          64,
        ),
    };

    if (!sanitized.message) {
      return NextResponse.json(
        { success: false, error: "message_required" },
        { status: 400 },
      );
    }

    console.error("[client-error-report]", sanitized);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "invalid_payload" },
      { status: 400 },
    );
  }
}
