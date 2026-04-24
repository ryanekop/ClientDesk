import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { updateSession } from '@/utils/supabase/middleware';
import { resolveTenant, type TenantConfig } from '@/lib/tenant-resolver';
import { NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware(routing);
const LOCALE_SET = new Set<string>(routing.locales);
const PUBLIC_LOCALIZED_PREFIXES = new Set([
    'formbooking',
    'track',
    'settlement',
    'pricing',
    'features',
]);

function setTenantHeaders(headers: Headers, tenant: TenantConfig) {
    headers.set('x-tenant-id', tenant.id);
    headers.set('x-tenant-slug', tenant.slug);
    headers.set('x-tenant-name', tenant.name);
    headers.set('x-tenant-domain', tenant.domain || '');
    headers.set('x-tenant-logo', tenant.logoUrl || '/icon-192.png');
    headers.set('x-tenant-favicon', tenant.faviconUrl || '');
    headers.set('x-tenant-color', tenant.primaryColor || '');
    headers.set('x-tenant-footer', tenant.footerText || '');
    headers.set(
        'x-tenant-disable-booking-slug',
        tenant.disableBookingSlug ? 'true' : 'false',
    );
    headers.set(
        'x-tenant-default-booking-vendor-slug',
        tenant.defaultBookingVendorSlug || '',
    );
}

function shouldBypassTenantCache(pathname: string) {
    if (/^\/(id|en)\/settings(?:\/|$)/.test(pathname)) {
        return true;
    }

    return pathname === '/api/settings/booking-url-mode';
}

function normalizePathname(pathname: string) {
    if (pathname.length > 1 && pathname.endsWith('/')) {
        return pathname.slice(0, -1);
    }

    return pathname;
}

function isLocalizedPublicRoute(pathname: string) {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) {
        return false;
    }

    const locale = segments[0];
    if (!LOCALE_SET.has(locale)) {
        return false;
    }

    if (segments.length === 1) {
        return true;
    }

    return PUBLIC_LOCALIZED_PREFIXES.has(segments[1]);
}

function shouldSkipAuthRefreshForApi(pathname: string) {
    if (pathname === '/api/public' || pathname.startsWith('/api/public/')) {
        return true;
    }

    // Callback routes can operate with their own auth handling and do not need
    // middleware-level session refresh on every request.
    return (
        pathname === '/api/auth/callback' ||
        pathname === '/api/google/callback' ||
        pathname === '/api/google/drive/callback'
    );
}

function shouldSkipAuthRefresh(request: NextRequest) {
    const pathname = normalizePathname(request.nextUrl.pathname);

    if (pathname === '/' && (request.method === 'GET' || request.method === 'HEAD')) {
        return true;
    }

    if (isLocalizedPublicRoute(pathname)) {
        return true;
    }

    if (pathname === '/auth/callback') {
        return true;
    }

    if (pathname.startsWith('/api/')) {
        return shouldSkipAuthRefreshForApi(pathname);
    }

    return false;
}

export default async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const skipAuthRefresh = shouldSkipAuthRefresh(request);

    request.headers.set(
        'x-current-path',
        `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );

    const hostname = request.headers.get('host') || '';
    const tenant = await resolveTenant(hostname, {
        bypassCache: shouldBypassTenantCache(pathname),
    });

    // Make tenant info readable by server components/routes.
    setTenantHeaders(request.headers, tenant);

    // API and non-localized auth callback routes: skip i18n but keep auth session refresh.
    if (pathname.startsWith('/api/') || pathname.startsWith('/auth/')) {
        const response = NextResponse.next({
            request: { headers: request.headers },
        });
        setTenantHeaders(response.headers, tenant);
        if (skipAuthRefresh) {
            return response;
        }
        return await updateSession(request, response);
    }

    const response = intlMiddleware(request);
    setTenantHeaders(response.headers, tenant);
    if (skipAuthRefresh) {
        return response;
    }
    return await updateSession(request, response);
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)',
    ],
};
