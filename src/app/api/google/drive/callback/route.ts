import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { getDriveOAuth2Client } from "@/utils/google/drive";
import { hasOAuthTokenPair } from "@/utils/google/connection";
import { createClient } from "@/utils/supabase/server";
import {
  buildGoogleOAuthReturnUrl,
  sanitizeGoogleOAuthOrigin,
  sanitizeGoogleOAuthReturnPath,
  verifySignedGoogleOAuthState,
} from "@/lib/google-oauth-state";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

function htmlResponse(html: string) {
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function decodeIdTokenEmail(idToken: string | null | undefined) {
  if (!idToken) return null;
  try {
    const payload = idToken.split(".")[1] || "";
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const parsed = JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as {
      email?: unknown;
    };
    return normalizeEmail(parsed.email);
  } catch {
    return null;
  }
}

function hasMissingEmailColumnError(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message || "")
      : "";
  return (
    message.includes("column") &&
    message.includes("google_drive_account_email")
  );
}

async function resolveGoogleAccountEmail(
  oauth2Client: ReturnType<typeof getDriveOAuth2Client>,
  accessToken: string | null | undefined,
  idToken: string | null | undefined,
) {
  const emailFromIdToken = decodeIdTokenEmail(idToken);
  if (emailFromIdToken) return emailFromIdToken;

  const normalizedAccessToken = normalizeEmail(accessToken);
  if (!normalizedAccessToken) return null;

  try {
    oauth2Client.setCredentials({ access_token: normalizedAccessToken });
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();
    return normalizeEmail(data.email);
  } catch {
    return null;
  }
}

function buildCallbackHtml(args: {
  success: boolean;
  errorCode?: string;
  targetOrigin: string | null;
  redirectOrigin: string | null;
  returnPath: string;
}) {
  const payload = args.success
    ? { type: "GOOGLE_DRIVE_SUCCESS" }
    : { type: "GOOGLE_DRIVE_ERROR", error: args.errorCode || "unknown_error" };

  const redirectUrl = buildGoogleOAuthReturnUrl({
    origin: args.redirectOrigin,
    returnPath: args.returnPath,
    service: "drive",
    status: args.success ? "success" : "error",
    error: args.success ? null : payload.error,
  });

  const successTitle = "✅ Google Drive Terhubung!";
  const successSubtitle = "Jendela ini akan tertutup otomatis...";
  const errorTitle = "⚠️ Gagal menghubungkan Google Drive";
  const errorSubtitle = args.errorCode
    ? `Kode error: ${args.errorCode}`
    : "Silakan coba lagi.";

  return htmlResponse(`<!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8" />
                <title>Menghubungkan...</title>
            </head>
            <body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;color:#333;">
                <div style="text-align:center;max-width:320px;">
                    <p style="font-size:1.2rem;font-weight:600;">${
                      args.success ? successTitle : errorTitle
                    }</p>
                    <p style="color:#888;">${
                      args.success ? successSubtitle : errorSubtitle
                    }</p>
                </div>
                <script>
                    var payload = ${JSON.stringify(payload)};
                    var redirectUrl = ${JSON.stringify(redirectUrl)};
                    var targetOrigin = ${JSON.stringify(
                      sanitizeGoogleOAuthOrigin(args.targetOrigin),
                    )};

                    try {
                        var ch = new BroadcastChannel("clientdesk-google-auth");
                        ch.postMessage(payload);
                        ch.close();
                    } catch (e) {}

                    if (window.opener) {
                        try {
                            if (targetOrigin) {
                                window.opener.postMessage(payload, targetOrigin);
                            } else {
                                window.opener.postMessage(payload, "*");
                            }
                        } catch (e) {}

                        setTimeout(function () {
                            try { window.close(); } catch (e) {}
                        }, 1200);

                        setTimeout(function () {
                            if (!window.closed) {
                                window.location.href = redirectUrl;
                            }
                        }, 2200);
                    } else {
                        setTimeout(function () {
                            window.location.href = redirectUrl;
                        }, 1200);
                    }
                </script>
            </body>
            </html>`);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const stateParam = url.searchParams.get("state");
  const verifiedState = verifySignedGoogleOAuthState(stateParam, "drive");
  const statePayload = verifiedState.valid ? verifiedState.payload : null;
  const returnPath = sanitizeGoogleOAuthReturnPath(statePayload?.returnPath);
  const targetOrigin = statePayload?.origin ?? null;
  const redirectOrigin = statePayload?.origin ?? request.nextUrl.origin;

  if (error || !code) {
    return buildCallbackHtml({
      success: false,
      errorCode: error || "no_code",
      targetOrigin,
      redirectOrigin,
      returnPath,
    });
  }

  try {
    const oauth2Client = getDriveOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    const resolvedGoogleEmail = await resolveGoogleAccountEmail(
      oauth2Client,
      tokens.access_token ?? null,
      tokens.id_token ?? null,
    );

    const supabase = await createClient();
    const {
      data: { user: sessionUser },
    } = await supabase.auth.getUser();

    const stateUserId = statePayload?.userId ?? null;
    const targetUserId = stateUserId || sessionUser?.id || null;

    if (!targetUserId) {
      return buildCallbackHtml({
        success: false,
        errorCode: stateParam ? "invalid_state" : "not_authenticated",
        targetOrigin,
        redirectOrigin,
        returnPath,
      });
    }

    const effectiveSessionUser =
      sessionUser && sessionUser.id === targetUserId ? sessionUser : null;

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select(
        "full_name, google_drive_access_token, google_drive_refresh_token, google_drive_account_email",
      )
      .eq("id", targetUserId)
      .maybeSingle();

    const fallbackFullName = normalizeEmail(existingProfile?.full_name) || "User";
    const fullName =
      String(effectiveSessionUser?.user_metadata?.full_name || "").trim() ||
      String(effectiveSessionUser?.email || "").split("@")[0] ||
      fallbackFullName;

    const resolvedAccessToken = normalizeEmail(
      tokens.access_token ?? existingProfile?.google_drive_access_token ?? null,
    );
    const resolvedRefreshToken = normalizeEmail(
      tokens.refresh_token ?? existingProfile?.google_drive_refresh_token ?? null,
    );

    if (!hasOAuthTokenPair(resolvedAccessToken, resolvedRefreshToken)) {
      return buildCallbackHtml({
        success: false,
        errorCode: "incomplete_token_pair",
        targetOrigin,
        redirectOrigin,
        returnPath,
      });
    }

    const profilePatch: Record<string, unknown> = {
      id: targetUserId,
      full_name: fullName,
      google_drive_access_token: resolvedAccessToken,
      google_drive_refresh_token: resolvedRefreshToken,
      google_drive_token_expiry: tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : null,
      google_drive_account_email:
        resolvedGoogleEmail ??
        normalizeEmail(existingProfile?.google_drive_account_email) ??
        null,
    };

    let { error: dbError } = await supabaseAdmin
      .from("profiles")
      .upsert(profilePatch, { onConflict: "id" });

    if (dbError && hasMissingEmailColumnError(dbError)) {
      delete profilePatch.google_drive_account_email;
      ({ error: dbError } = await supabaseAdmin
        .from("profiles")
        .upsert(profilePatch, { onConflict: "id" }));
    }

    if (dbError) {
      return buildCallbackHtml({
        success: false,
        errorCode: "db_error",
        targetOrigin,
        redirectOrigin,
        returnPath,
      });
    }

    return buildCallbackHtml({
      success: true,
      targetOrigin,
      redirectOrigin,
      returnPath,
    });
  } catch {
    return buildCallbackHtml({
      success: false,
      errorCode: "token_exchange_failed",
      targetOrigin,
      redirectOrigin,
      returnPath,
    });
  }
}
