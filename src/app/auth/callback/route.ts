import { NextRequest, NextResponse } from 'next/server'

/**
 * This route handles auth callbacks from Supabase (invite, recovery, etc.)
 * that redirect to /auth/callback WITHOUT a locale prefix.
 * 
 * The auth tokens are in the URL fragment (#access_token=...), which is NOT
 * sent to the server. So we return a small HTML page that uses client-side JS
 * to redirect to /id/auth/callback while preserving the hash fragment.
 */
export async function GET(request: NextRequest) {
    const url = new URL(request.url)

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Redirecting...</title></head>
<body>
<p>Redirecting...</p>
<script>
  // Preserve hash fragment by redirecting client-side
  window.location.replace('/id/auth/callback' + window.location.search + window.location.hash);
</script>
</body>
</html>`

    return new NextResponse(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
    })
}
