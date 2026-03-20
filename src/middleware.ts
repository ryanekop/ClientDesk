import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { updateSession } from '@/utils/supabase/middleware';
import { resolveTenant, type TenantConfig } from '@/lib/tenant-resolver';
import { NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware(routing);

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

export default async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

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
        return await updateSession(request, response);
    }

    const response = intlMiddleware(request);
    setTenantHeaders(response.headers, tenant);
    return await updateSession(request, response);
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)',
    ],
};
