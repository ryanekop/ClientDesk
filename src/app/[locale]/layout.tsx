import type { Metadata } from "next";
import Script from "next/script";
import { Geist } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { ThemeProvider } from "@/components/theme-provider";
import { getTenantConfig } from "@/lib/tenant-config";
import { TenantProvider } from "@/lib/tenant-context";
import "../globals.css";

const geistSans = Geist({
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenantConfig();
  const ogImage =
    tenant.logoUrl && tenant.logoUrl.startsWith("http")
      ? tenant.logoUrl
      : "/icon-192.png";

  return {
    title: {
      default: `${tenant.name} - Vendor Management`,
      template: `%s - ${tenant.name}`,
    },
    description: "Minimalist and modern client management for freelancers.",
    icons: {
      icon: tenant.faviconUrl
        ? [{ url: tenant.faviconUrl }]
        : [
            { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
            { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
          ],
      apple: tenant.faviconUrl || "/apple-touch-icon.png",
    },
    openGraph: {
      title: `${tenant.name} - Vendor Management`,
      description: "Minimalist and modern client management for freelancers.",
      images: [{ url: ogImage }],
    },
  };
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  // Ensure that the incoming `locale` is valid
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();
  const tenant = await getTenantConfig();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <Script
          src="https://cloud.umami.is/script.js"
          data-website-id="50dbf632-4580-45e9-a67e-a651da1e4d42"
          strategy="afterInteractive"
        />
      </head>
      <body
        className={`${geistSans.className} antialiased bg-background text-foreground`}
        style={
          tenant.primaryColor
            ? ({ "--tenant-primary": tenant.primaryColor } as React.CSSProperties)
            : undefined
        }
      >
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <TenantProvider
              tenant={{
                id: tenant.id,
                slug: tenant.slug,
                name: tenant.name,
                domain: tenant.domain || "",
                logoUrl: tenant.logoUrl || "/icon-192.png",
                faviconUrl: tenant.faviconUrl || "",
                primaryColor: tenant.primaryColor || "",
                footerText: tenant.footerText || "",
                disableBookingSlug: tenant.disableBookingSlug,
                defaultBookingVendorSlug: tenant.defaultBookingVendorSlug || "",
              }}
            >
              {children}
            </TenantProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
