export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { findActiveBlockForEmail, isValidBlocklistEmail, normalizeBlocklistEmail } from '@/lib/auth/email-blocklist';
import { resolveApiLocale } from '@/lib/i18n/api-locale';
import { apiT } from '@/lib/i18n/api-errors';
import { createServiceClient } from '@/lib/supabase/service';
import { notifyBlockedLoginAttempt } from '@/utils/telegram';

function getRequestIp(request: NextRequest) {
    return request.headers.get('cf-connecting-ip')
        || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip')
        || 'unknown';
}

export async function POST(request: NextRequest) {
    const locale = resolveApiLocale(request);

    try {
        const body = await request.json().catch(() => ({})) as {
            email?: string;
        };
        const email = normalizeBlocklistEmail(body.email);

        if (!email) {
            return NextResponse.json({ error: apiT(locale, 'emailRequired') }, { status: 400 });
        }

        if (!isValidBlocklistEmail(email)) {
            return NextResponse.json({ error: apiT(locale, 'invalidEmailFormat') }, { status: 400 });
        }

        const supabase = createServiceClient();
        const activeBlock = await findActiveBlockForEmail(supabase, email);

        if (!activeBlock) {
            return NextResponse.json({ blocked: false });
        }

        await notifyBlockedLoginAttempt({
            email,
            reason: activeBlock.reason,
            suspendedUserId: activeBlock.suspended_user_id,
            ip: getRequestIp(request),
            device: request.headers.get('user-agent') || '',
        });

        return NextResponse.json(
            {
                blocked: true,
                error: apiT(locale, 'accountAccessUnavailable'),
            },
            { status: 403 },
        );
    } catch (error) {
        console.error('[Blocked Login Attempt] Error:', error);
        return NextResponse.json({ error: apiT(locale, 'validationUnexpectedError') }, { status: 500 });
    }
}
