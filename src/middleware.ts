import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { updateSession } from '@/utils/supabase/middleware';
import { NextRequest } from 'next/server';

const intlMiddleware = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
    // First, run next-intl routing translation resolution
    const response = intlMiddleware(request);

    // Then, attach the response to supabase session updater to refresh cookies
    return await updateSession(request, response);
}

export const config = {
    // Match only internationalized pathnames
    matcher: ['/', '/(id|en)/:path*']
};
