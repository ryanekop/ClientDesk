export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { isMainClientDeskDomain } from '@/lib/booking-url-mode'
import { resolveTenant } from '@/lib/tenant-resolver'
import { resolveApiLocale } from '@/lib/i18n/api-locale'
import { apiT } from '@/lib/i18n/api-errors'
import {
    getRequestHostname,
    normalizeAuthLocale,
    resolvePublicOrigin,
} from '@/lib/auth/public-origin'
import { findActiveBlockForEmail } from '@/lib/auth/email-blocklist'

function getSupabaseAdmin() {
    return createSupabaseAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )
}

function normalizeRole(value: string | null | undefined) {
    return (value || '').trim().toLowerCase()
}

function isValidEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function POST(request: NextRequest) {
    const requestLocale = resolveApiLocale(request)

    try {
        const body = await request.json().catch(() => ({})) as {
            email?: string
            locale?: string
        }
        const email = typeof body.email === 'string' ? body.email.trim() : ''
        const locale = normalizeAuthLocale(body.locale || requestLocale)

        if (!email) {
            return NextResponse.json({ error: apiT(requestLocale, 'emailRequired') }, { status: 400 })
        }
        if (!isValidEmail(email)) {
            return NextResponse.json({ error: apiT(requestLocale, 'invalidEmailFormat') }, { status: 400 })
        }

        const supabase = await createServerClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role, tenant_id')
            .eq('id', user.id)
            .maybeSingle()

        if (profileError || !profile) {
            return NextResponse.json({ error: apiT(requestLocale, 'invalidProfileAccess') }, { status: 403 })
        }

        const role = normalizeRole(profile.role)
        if (role !== 'admin' && role !== 'staff') {
            return NextResponse.json({ error: apiT(requestLocale, 'inviteAdminStaffOnly') }, { status: 403 })
        }

        const hostname = getRequestHostname(request)
        if (!hostname) {
            return NextResponse.json({ error: apiT(requestLocale, 'invalidRequestHost') }, { status: 400 })
        }

        const tenant = await resolveTenant(hostname, { bypassCache: true })
        const isMainDomain = isMainClientDeskDomain(hostname)

        if (tenant.id === 'default' && !isMainDomain) {
            return NextResponse.json({ error: apiT(requestLocale, 'tenantDomainUnknown') }, { status: 400 })
        }

        if (!isMainDomain && tenant.id !== 'default' && profile.tenant_id !== tenant.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const redirectOrigin = resolvePublicOrigin(request)
        const redirectTo = `${redirectOrigin}/${locale}/auth/callback?type=invite`

        const supabaseAdmin = getSupabaseAdmin()
        const activeBlock = await findActiveBlockForEmail(supabaseAdmin, email)
        if (activeBlock) {
            return NextResponse.json({ error: apiT(requestLocale, 'accountAccessUnavailable') }, { status: 403 })
        }

        // Invite user via magic link
        const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            redirectTo
        })

        if (error) {
            console.error('Invite error:', error)
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        return NextResponse.json({ success: true, user: data.user, redirectTo })
    } catch (error) {
        console.error('Invite API error:', error)
        return NextResponse.json({ error: apiT(requestLocale, 'failedSendInvite') }, { status: 500 })
    }
}
