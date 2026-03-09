import { NextRequest, NextResponse } from "next/server";
import { getOAuth2Client } from "@/utils/google/calendar";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error || !code) {
        // Return HTML that closes the popup with an error
        return new NextResponse(
            `<!DOCTYPE html>
            <html><body><script>
                window.opener?.postMessage({ type: "GOOGLE_AUTH_ERROR", error: "${error || "no_code"}" }, "*");
                window.close();
            </script></body></html>`,
            { headers: { "Content-Type": "text/html" } }
        );
    }

    try {
        const oauth2Client = getOAuth2Client();
        const { tokens } = await oauth2Client.getToken(code);

        // Get current user from Supabase
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return new NextResponse(
                `<!DOCTYPE html>
                <html><body><script>
                    window.opener?.postMessage({ type: "GOOGLE_AUTH_ERROR", error: "not_authenticated" }, "*");
                    window.close();
                </script></body></html>`,
                { headers: { "Content-Type": "text/html" } }
            );
        }

        // Store tokens in profiles table
        const { error: dbError } = await supabase
            .from("profiles")
            .update({
                google_access_token: tokens.access_token,
                google_refresh_token: tokens.refresh_token,
                google_token_expiry: tokens.expiry_date
                    ? new Date(tokens.expiry_date).toISOString()
                    : null,
            })
            .eq("id", user.id);

        if (dbError) {
            return new NextResponse(
                `<!DOCTYPE html>
                <html><body><script>
                    window.opener?.postMessage({ type: "GOOGLE_AUTH_ERROR", error: "db_error" }, "*");
                    window.close();
                </script></body></html>`,
                { headers: { "Content-Type": "text/html" } }
            );
        }

        // Success - close popup and notify parent
        return new NextResponse(
            `<!DOCTYPE html>
            <html>
            <head><title>Menghubungkan...</title></head>
            <body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;color:#333;">
                <div style="text-align:center;">
                    <p style="font-size:1.2rem;font-weight:600;">✅ Google Calendar Terhubung!</p>
                    <p style="color:#888;">Jendela ini akan tertutup otomatis...</p>
                </div>
                <script>
                    if (window.opener) {
                        window.opener.postMessage({ type: "GOOGLE_AUTH_SUCCESS" }, "*");
                        setTimeout(() => window.close(), 1500);
                    } else {
                        // Fallback: if opened in same tab (popup blocked), redirect back
                        setTimeout(() => { window.location.href = "/id/calendar"; }, 1500);
                    }
                </script>
            </body>
            </html>`,
            { headers: { "Content-Type": "text/html" } }
        );
    } catch (err: any) {
        return new NextResponse(
            `<!DOCTYPE html>
            <html><body><script>
                window.opener?.postMessage({ type: "GOOGLE_AUTH_ERROR", error: "token_exchange_failed" }, "*");
                window.close();
            </script></body></html>`,
            { headers: { "Content-Type": "text/html" } }
        );
    }
}
