import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getDriveOAuth2Client } from "@/utils/google/drive";
import { createClient } from "@/utils/supabase/server";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    return new NextResponse(
      `<!DOCTYPE html><html><body><script>
                window.opener?.postMessage({ type: "GOOGLE_DRIVE_ERROR", error: "${error || "no_code"}" }, "*");
                window.close();
            </script></body></html>`,
      { headers: { "Content-Type": "text/html" } },
    );
  }

  try {
    const oauth2Client = getDriveOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new NextResponse(
        `<!DOCTYPE html><html><body><script>
                    window.opener?.postMessage({ type: "GOOGLE_DRIVE_ERROR", error: "not_authenticated" }, "*");
                    window.close();
                </script></body></html>`,
        { headers: { "Content-Type": "text/html" } },
      );
    }

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("google_drive_access_token, google_drive_refresh_token")
      .eq("id", user.id)
      .maybeSingle();

    const { error: dbError } = await supabaseAdmin.from("profiles").upsert(
      {
        id: user.id,
        full_name: String(
          user.user_metadata?.full_name || user.email?.split("@")[0] || "",
        ),
        google_drive_access_token:
          tokens.access_token ??
          existingProfile?.google_drive_access_token ??
          null,
        google_drive_refresh_token:
          tokens.refresh_token ??
          existingProfile?.google_drive_refresh_token ??
          null,
        google_drive_token_expiry: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : null,
      },
      { onConflict: "id" },
    );

    if (dbError) {
      return new NextResponse(
        `<!DOCTYPE html><html><body><script>
                    window.opener?.postMessage({ type: "GOOGLE_DRIVE_ERROR", error: "db_error" }, "*");
                    window.close();
                </script></body></html>`,
        { headers: { "Content-Type": "text/html" } },
      );
    }

    return new NextResponse(
      `<!DOCTYPE html>
            <html>
            <head><title>Menghubungkan...</title></head>
            <body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;color:#333;">
                <div style="text-align:center;">
                    <p style="font-size:1.2rem;font-weight:600;">✅ Google Drive Terhubung!</p>
                    <p style="color:#888;">Jendela ini akan tertutup otomatis...</p>
                </div>
                <script>
                    // BroadcastChannel: lebih reliable dari window.opener.postMessage
                    // karena window.opener bisa menjadi null setelah cross-origin redirect ke Google
                    try {
                        var ch = new BroadcastChannel("clientdesk-google-auth");
                        ch.postMessage({ type: "GOOGLE_DRIVE_SUCCESS" });
                        ch.close();
                    } catch(e) {}
                    // Fallback: postMessage via window.opener
                    if (window.opener) {
                        try { window.opener.postMessage({ type: "GOOGLE_DRIVE_SUCCESS" }, "*"); } catch(e) {}
                        setTimeout(() => window.close(), 1500);
                    } else {
                        // Fallback: if opened in same tab (popup blocked), redirect back to settings
                        setTimeout(() => { window.location.href = "/id/settings"; }, 1500);
                    }
                </script>
            </body>
            </html>`,
      { headers: { "Content-Type": "text/html" } },
    );
  } catch {
    return new NextResponse(
      `<!DOCTYPE html><html><body><script>
                window.opener?.postMessage({ type: "GOOGLE_DRIVE_ERROR", error: "token_exchange_failed" }, "*");
                window.close();
            </script></body></html>`,
      { headers: { "Content-Type": "text/html" } },
    );
  }
}
