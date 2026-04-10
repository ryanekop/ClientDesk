This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Runtime Hotfix Knobs

These env vars control auth-refresh and tenant-cache behavior in middleware:

- `AUTH_REFRESH_TIMEOUT_MS=1200`
- `AUTH_REFRESH_FAIL_OPEN=true`
- `TENANT_CACHE_TTL_MS=300000`

Public link origin resolution (used by calendar `booking_detail_link` and other public links):

- `NEXT_PUBLIC_SITE_URL=https://...` is fallback origin when request host cannot be resolved safely.
- `PUBLIC_ORIGIN_ALLOWLIST=https://a.com,https://b.com` is optional strict allowlist.
- Leave `PUBLIC_ORIGIN_ALLOWLIST` empty to follow current request domain/host (recommended for multi-domain tenant setups).
- If `PUBLIC_ORIGIN_ALLOWLIST` is set, only listed origins are used for public-link generation in server routes.

Emergency toggle for security headers (set in `.env.local` and redeploy):

- `DISABLE_SECURITY_HEADERS=true` turns OFF all global security headers.
- `DISABLE_SECURITY_HEADERS=false` (or unset) keeps security headers ON (default).

Use `DISABLE_SECURITY_HEADERS=true` only for incident recovery, then switch it back off.
For localhost admin previews that render public pages inside an `iframe` (for example Form Booking preview), set `DISABLE_SECURITY_HEADERS=true` during local development so CSP/X-Frame headers do not block the preview frame.

Current CSP defaults include:

- `http://localhost:3000` in `connect-src` for local development flows.
- Google Maps hosts (`https://maps.googleapis.com` and `https://maps.gstatic.com`) in `script-src` and `connect-src`.
- Umami host (`https://cloud.umami.is`) for analytics script and network requests.

If you use vendor/custom domains, also allowlist those domains in external service dashboards:

- Google Cloud Console: add each domain to allowed HTTP referrers for your Maps API key.
- Umami website settings: add each domain to allowed domains for the tracked website.

## Upload Limit (VPS + Nginx)

App-level limit for Google-related uploads (payment proof, QRIS, client files) is **5MB**.

If you deploy behind Nginx, set proxy body limit above 5MB to avoid multipart overhead false-rejects:

```nginx
client_max_body_size 8M;
```

After changing Nginx config, reload/restart Nginx.

## Session-Time Status Sync Cron

If you enable the "Trigger Otomatis Saat Jam Sesi Tiba" setting, add a server cron
that calls the admin sync endpoint every minute after deploy:

```bash
curl -X POST \
  -H "x-admin-api-key: $ADMIN_API_KEY" \
  https://your-domain.com/api/admin/session-time-status-sync
```

Recommended schedule:

```cron
* * * * * /usr/bin/curl -fsS -X POST -H "x-admin-api-key: YOUR_ADMIN_API_KEY" https://your-domain.com/api/admin/session-time-status-sync >/dev/null
```

Keep this cron disabled until the app changes are deployed and the profile columns
from `supabase_migration_session_time_trigger_status.sql` have been applied.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
