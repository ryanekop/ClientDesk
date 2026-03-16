import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { getOAuth2Client } from "@/utils/google/calendar";
import { createClient } from "@/utils/supabase/server";

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
    message.includes("google_calendar_account_email")
  );
}

async function resolveGoogleAccountEmail(
  oauth2Client: ReturnType<typeof getOAuth2Client>,
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

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    // Return HTML that closes the popup with an error
    return htmlResponse(
      `<!DOCTYPE html>
            <html><body><script>
                window.opener?.postMessage({ type: "GOOGLE_AUTH_ERROR", error: "${error || "no_code"}" }, "*");
                window.close();
            </script></body></html>`,
    );
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    const resolvedGoogleEmail = await resolveGoogleAccountEmail(
      oauth2Client,
      tokens.access_token ?? null,
      tokens.id_token ?? null,
    );

    // Get current user from Supabase
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return htmlResponse(
        `<!DOCTYPE html>
                <html><body><script>
                    window.opener?.postMessage({ type: "GOOGLE_AUTH_ERROR", error: "not_authenticated" }, "*");
                    window.close();
                </script></body></html>`,
      );
    }

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select(
        "google_access_token, google_refresh_token, google_calendar_account_email",
      )
      .eq("id", user.id)
      .maybeSingle();

    const profilePatch: Record<string, unknown> = {
      id: user.id,
      full_name: String(
        user.user_metadata?.full_name || user.email?.split("@")[0] || "",
      ),
      google_access_token:
        tokens.access_token ?? existingProfile?.google_access_token ?? null,
      google_refresh_token:
        tokens.refresh_token ?? existingProfile?.google_refresh_token ?? null,
      google_token_expiry: tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : null,
      google_calendar_account_email:
        resolvedGoogleEmail ??
        normalizeEmail(existingProfile?.google_calendar_account_email) ??
        null,
    };

    // Store tokens (and email when migration is available) in profiles table
    let { error: dbError } = await supabaseAdmin
      .from("profiles")
      .upsert(profilePatch, { onConflict: "id" });

    if (dbError && hasMissingEmailColumnError(dbError)) {
      delete profilePatch.google_calendar_account_email;
      ({ error: dbError } = await supabaseAdmin
        .from("profiles")
        .upsert(profilePatch, { onConflict: "id" }));
    }

    if (dbError) {
      return htmlResponse(
        `<!DOCTYPE html>
                <html><body><script>
                    window.opener?.postMessage({ type: "GOOGLE_AUTH_ERROR", error: "db_error" }, "*");
                    window.close();
                </script></body></html>`,
      );
    }

    // Success - close popup and notify parent
    return htmlResponse(
      `<!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8" />
                <title>Menghubungkan...</title>
            </head>
            <body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;color:#333;">
                <div style="text-align:center;">
                    <p style="font-size:1.2rem;font-weight:600;">✅ Google Calendar Terhubung!</p>
                    <p style="color:#888;">Jendela ini akan tertutup otomatis...</p>
                </div>
                <script>
                    // BroadcastChannel: lebih reliable dari window.opener.postMessage
                    // karena window.opener bisa menjadi null setelah cross-origin redirect ke Google
                    try {
                        var ch = new BroadcastChannel("clientdesk-google-auth");
                        ch.postMessage({ type: "GOOGLE_AUTH_SUCCESS" });
                        ch.close();
                    } catch(e) {}
                    // Fallback: postMessage via window.opener
                    if (window.opener) {
                        try { window.opener.postMessage({ type: "GOOGLE_AUTH_SUCCESS" }, "*"); } catch(e) {}
                        setTimeout(() => window.close(), 1500);
                    } else {
                        // Fallback: if opened in same tab (popup blocked), redirect back to settings
                        setTimeout(() => { window.location.href = "/id/settings"; }, 1500);
                    }
                </script>
            </body>
            </html>`,
    );
  } catch {
    return htmlResponse(
      `<!DOCTYPE html>
            <html><body><script>
                window.opener?.postMessage({ type: "GOOGLE_AUTH_ERROR", error: "token_exchange_failed" }, "*");
                window.close();
            </script></body></html>`,
    );
  }
}
