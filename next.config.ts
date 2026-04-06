import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();
const DISABLE_SECURITY_HEADERS =
  process.env.DISABLE_SECURITY_HEADERS?.trim().toLowerCase() === "true";

const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://cloud.umami.is https://maps.googleapis.com https://maps.gstatic.com",
      "connect-src 'self' http://localhost:3000 https://*.supabase.co https://www.googleapis.com https://oauth2.googleapis.com https://challenges.cloudflare.com https://api.telegram.org https://cloud.umami.is https://maps.googleapis.com https://maps.gstatic.com",
      "frame-src 'self' https://challenges.cloudflare.com https://www.google.com https://*.google.com",
      "form-action 'self'",
    ].join("; "),
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    // Tree-shake hanya icons/komponen yang benar-benar dipakai
    // dari library besar — mengurangi bundle size secara signifikan
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "recharts",
      "date-fns",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-slot",
    ],
  },

  // Optimasi gambar — izinkan domain Supabase storage
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    const globalSecurityHeaders = DISABLE_SECURITY_HEADERS
      ? []
      : [
          {
            source: "/:path*",
            headers: SECURITY_HEADERS,
          },
        ];

    return [
      ...globalSecurityHeaders,
      {
        source: "/icon-192.png",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/icon-512.png",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/apple-touch-icon.png",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
