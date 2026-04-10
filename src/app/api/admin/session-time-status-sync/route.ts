import { NextRequest, NextResponse } from "next/server";

import {
  buildAdminCorsHeaders,
  isAdminCorsOriginAllowed,
} from "@/lib/security/admin-cors";
import { runSessionTimeStatusSync } from "@/lib/session-time-status-sync";

const ADMIN_CORS_METHODS = "POST, OPTIONS";

function corsResponse(
  request: NextRequest,
  data: unknown,
  init?: { status?: number },
) {
  return NextResponse.json(data, {
    ...init,
    headers: buildAdminCorsHeaders(request, ADMIN_CORS_METHODS),
  });
}

function verifyAdmin(request: NextRequest) {
  const apiKey = request.headers.get("x-admin-api-key");
  const isValid = Boolean(apiKey && apiKey === process.env.ADMIN_API_KEY);
  if (!isValid) {
    const ip = request.headers.get("cf-connecting-ip")
      || request.headers.get("x-forwarded-for")
      || request.headers.get("x-real-ip")
      || "unknown";
    console.warn(
      `[Admin API] Unauthorized access attempt on ${request.nextUrl.pathname} from ${ip}`,
    );
  }
  return isValid;
}

export async function OPTIONS(request: NextRequest) {
  if (!isAdminCorsOriginAllowed(request)) {
    return NextResponse.json(
      { error: "Origin not allowed" },
      { status: 403, headers: buildAdminCorsHeaders(request, ADMIN_CORS_METHODS) },
    );
  }

  return new NextResponse(null, {
    status: 204,
    headers: buildAdminCorsHeaders(request, ADMIN_CORS_METHODS),
  });
}

export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return corsResponse(request, { error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runSessionTimeStatusSync();
    return corsResponse(request, {
      success: true,
      ...summary,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to run session time status sync";
    return corsResponse(request, { success: false, error: message }, { status: 500 });
  }
}
