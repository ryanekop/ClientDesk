export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getSubscription, createTrialSubscription } from '@/utils/subscription-service'
import { notifyNewSignup } from '@/utils/telegram'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const type = searchParams.get('type') // 'recovery', 'invite', etc.
    const next = searchParams.get('next')
    const locale = searchParams.get('locale') || 'id'

    if (code) {
        const supabase = await createClient()
        const { error, data: sessionData } = await supabase.auth.exchangeCodeForSession(code)

        if (!error) {
            // =============================================
            // AUTO-CREATE TRIAL for new signups
            // =============================================
            const userId = sessionData?.user?.id
            if (userId) {
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

                // Sync full_name to profiles table
                if (fullName) {
                    await supabase.from('profiles').update({ full_name: fullName }).eq('id', userId)
                }
            }

            const forwardedHost = request.headers.get('x-forwarded-host')
            const isLocalEnv = process.env.NODE_ENV === 'development'

            let redirectPath = next || `/${locale}/dashboard`
            if (type === 'recovery' || type === 'invite') {
                redirectPath = `/${locale}/reset-password`
            }

            if (isLocalEnv) {
                return NextResponse.redirect(`${origin}${redirectPath}`)
            } else if (forwardedHost) {
                return NextResponse.redirect(`https://${forwardedHost}${redirectPath}`)
            } else {
                return NextResponse.redirect(`${origin}${redirectPath}`)
            }
        } else {
            console.error('Auth callback error:', error.message)
        }
    }

    return NextResponse.redirect(`${origin}/${locale}/login?error=auth_code_error`)
}

/**
 * POST handler: called from client-side callback page to create trial subscription
 * after PKCE/implicit exchange happens in the browser (cross-device email confirmation).
 */
export async function POST(request: Request) {
    try {
        const { userId, email, fullName } = await request.json()
        if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

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
                email: email || 'unknown',
                fullName: fullName || '',
                type: 'signup',
                trialDays: 5,
                ip,
                device,
            }).catch(() => { })
        }

        // Sync full_name to profiles table
        if (fullName) {
            const { createClient } = await import('@supabase/supabase-js')
            const supabaseAdmin = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!,
                { auth: { autoRefreshToken: false, persistSession: false } }
            )
            await supabaseAdmin.from('profiles').update({ full_name: fullName }).eq('id', userId)
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('[Callback POST] Error creating trial:', err)
        return NextResponse.json({ error: 'Failed' }, { status: 500 })
    }
}
