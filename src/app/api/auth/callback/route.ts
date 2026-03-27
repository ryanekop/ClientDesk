export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { resolveTenant } from '@/lib/tenant-resolver'
import { getSubscription, createTrialSubscription } from '@/utils/subscription-service'
import { notifyNewSignup } from '@/utils/telegram'
import { invalidatePublicCachesForProfile } from '@/lib/public-cache-invalidation'
import {
    getRequestHostname,
    normalizeAuthLocale,
    resolvePublicOrigin,
    resolveSafeNextPath,
} from '@/lib/auth/public-origin'

function withOrigin(origin: string, path: string) {
    const resolvedPath = path.startsWith('/') ? path : `/${path}`
    return `${origin}${resolvedPath}`
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const type = searchParams.get('type') // 'recovery', 'invite', etc.
    const locale = normalizeAuthLocale(searchParams.get('locale'))
    const next = resolveSafeNextPath(searchParams.get('next'), locale)
    const publicOrigin = resolvePublicOrigin(request)

    if (code) {
        const supabase = await createClient()
        const { error, data: sessionData } = await supabase.auth.exchangeCodeForSession(code)

        if (!error) {
            // =============================================
            // AUTO-CREATE TRIAL for new signups
            // =============================================
            const userId = sessionData?.user?.id
            if (userId) {
                let shouldInvalidateProfileCache = false
                const userEmail = sessionData?.user?.email || 'unknown'
                const fullName = sessionData?.user?.user_metadata?.full_name || ''

                const existingSub = await getSubscription(userId)
                if (!existingSub) {
                    await createTrialSubscription(userId)
                    // Notify admin via Telegram (fire-and-forget)
                    const ip = request.headers.get('cf-connecting-ip')
                        || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
                        || request.headers.get('x-real-ip')
                        || 'unknown'
                    const device = request.headers.get('user-agent') || ''
                    const isInvite = type === 'invite'
                    notifyNewSignup({
                        email: userEmail,
                        fullName,
                        type: isInvite ? 'invite' : 'signup',
                        trialDays: 5,
                        ip,
                        device,
                    }).catch(() => { })
                }

                // Sync full_name to profiles table (upsert to ensure row exists)
                if (fullName) {
                    await supabase.from('profiles').upsert(
                        { id: userId, full_name: fullName },
                        { onConflict: 'id' }
                    )
                    shouldInvalidateProfileCache = true
                }

                // =============================================
                // MULTI-TENANT: Auto-assign tenant_id to profile
                // =============================================
                const hostname = getRequestHostname(request)
                const tenant = await resolveTenant(hostname)

                if (tenant.id !== 'default') {
                    const { data: existingProfile } = await supabase
                        .from('profiles')
                        .select('id, tenant_id')
                        .eq('id', userId)
                        .single()

                    if (existingProfile && !existingProfile.tenant_id) {
                        const { error: tenantAssignError } = await supabase
                            .from('profiles')
                            .update({ tenant_id: tenant.id })
                            .eq('id', userId)
                        if (!tenantAssignError) {
                            shouldInvalidateProfileCache = true
                        }
                    }
                    // If tenant_id already exists, do not override.
                }

                if (shouldInvalidateProfileCache) {
                    invalidatePublicCachesForProfile({ userId })
                }
            }

            let redirectPath = next
            if (type === 'recovery' || type === 'invite') {
                redirectPath = `/${locale}/reset-password`
            }
            return NextResponse.redirect(withOrigin(publicOrigin, redirectPath))
        } else {
            console.error('Auth callback error:', error.message)
        }
    }

    return NextResponse.redirect(withOrigin(publicOrigin, `/${locale}/login?error=auth_code_error`))
}

/**
 * POST handler: called from client-side callback page to create trial subscription
 * after PKCE/implicit exchange happens in the browser (cross-device email confirmation).
 */
export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({})) as {
            userId?: string
            email?: string
            fullName?: string
        }
        const requestedUserId = typeof body.userId === 'string' ? body.userId : null

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (requestedUserId && requestedUserId !== user.id) {
            console.warn('[Callback POST] Ignoring mismatched userId from request body')
        }

        const userId = user.id
        const userEmail = typeof body.email === 'string' && body.email.trim()
            ? body.email.trim()
            : user.email || 'unknown'
        const metadataFullName = typeof user.user_metadata?.full_name === 'string'
            ? user.user_metadata.full_name
            : ''
        const fullName = typeof body.fullName === 'string' && body.fullName.trim()
            ? body.fullName.trim()
            : metadataFullName

        const existingSub = await getSubscription(userId)
        if (!existingSub) {
            await createTrialSubscription(userId)
            // Notify admin via Telegram (fire-and-forget)
            const ip = request.headers.get('cf-connecting-ip')
                || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
                || request.headers.get('x-real-ip')
                || 'unknown'
            const device = request.headers.get('user-agent') || ''
            notifyNewSignup({
                email: userEmail,
                fullName: fullName || '',
                type: 'signup',
                trialDays: 5,
                ip,
                device,
            }).catch(() => { })
        }

        // Sync full_name to profiles table (upsert to ensure row exists)
        if (fullName) {
            const { createClient } = await import('@supabase/supabase-js')
            const supabaseAdmin = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!,
                { auth: { autoRefreshToken: false, persistSession: false } }
            )
            await supabaseAdmin.from('profiles').upsert(
                { id: userId, full_name: fullName },
                { onConflict: 'id' }
            )
            invalidatePublicCachesForProfile({ userId })
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('[Callback POST] Error creating trial:', err)
        return NextResponse.json({ error: 'Failed' }, { status: 500 })
    }
}
