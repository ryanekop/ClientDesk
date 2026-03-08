import { NextRequest, NextResponse } from "next/server";
import { getDriveOAuth2Client } from "@/utils/google/drive";
import { createClient } from "@/utils/supabase/server";

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
            { headers: { "Content-Type": "text/html" } }
        );
    }

    try {
        const oauth2Client = getDriveOAuth2Client();
        const { tokens } = await oauth2Client.getToken(code);

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return new NextResponse(
                `<!DOCTYPE html><html><body><script>
                    window.opener?.postMessage({ type: "GOOGLE_DRIVE_ERROR", error: "not_authenticated" }, "*");
                    window.close();
                </script></body></html>`,
                { headers: { "Content-Type": "text/html" } }
            );
        }

        await supabase
            .from("profiles")
            .update({
                google_drive_access_token: tokens.access_token,
                google_drive_refresh_token: tokens.refresh_token,
                google_drive_token_expiry: tokens.expiry_date
                    ? new Date(tokens.expiry_date).toISOString()
                    : null,
            })
            .eq("id", user.id);

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
                    window.opener?.postMessage({ type: "GOOGLE_DRIVE_SUCCESS" }, "*");
                    setTimeout(() => window.close(), 1500);
                </script>
            </body>
            </html>`,
            { headers: { "Content-Type": "text/html" } }
        );
    } catch (err: any) {
        return new NextResponse(
            `<!DOCTYPE html><html><body><script>
                window.opener?.postMessage({ type: "GOOGLE_DRIVE_ERROR", error: "token_exchange_failed" }, "*");
                window.close();
            </script></body></html>`,
            { headers: { "Content-Type": "text/html" } }
        );
    }
}
