export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveApiLocale } from '@/lib/i18n/api-locale'
import { apiT } from '@/lib/i18n/api-errors'
import { normalizeAuthLocale, resolvePublicOrigin } from '@/lib/auth/public-origin'

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )
}

function getSupabaseAnon() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )
}

function isValidEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

async function findAuthUserByEmail(email: string) {
    const admin = getSupabaseAdmin()
    const normalizedEmail = email.trim().toLowerCase()
    let page = 1

    while (true) {
        const { data, error } = await admin.auth.admin.listUsers({
            page,
            perPage: 1000,
        })

        if (error) {
            throw error
        }

        const users = data?.users || []
        const existingUser = users.find((u) => u.email?.toLowerCase() === normalizedEmail)
        if (existingUser) {
            return existingUser
        }

        if (users.length < 1000) {
            return null
        }

        page += 1
    }
}

export async function POST(request: NextRequest) {
    const requestLocale = resolveApiLocale(request)

    try {
        const body = await request.json().catch(() => ({})) as {
            email?: string
            captchaToken?: string
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
        if (!body.captchaToken) {
            return NextResponse.json({ error: apiT(requestLocale, 'captchaNotVerified') }, { status: 400 })
        }

        const turnstileRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                secret: process.env.TURNSTILE_SECRET_KEY,
                response: body.captchaToken,
                remoteip: request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '',
            }),
        })

        const turnstileData = await turnstileRes.json()
        if (!turnstileData.success) {
            return NextResponse.json({ error: apiT(requestLocale, 'captchaVerificationFailed') }, { status: 400 })
        }

        const existingUser = await findAuthUserByEmail(email)
        if (!existingUser) {
            return NextResponse.json({ error: apiT(requestLocale, 'emailNotFound') }, { status: 404 })
        }
        if (existingUser.email_confirmed_at) {
            return NextResponse.json({ error: apiT(requestLocale, 'emailAlreadyRegisteredPleaseLogin') }, { status: 409 })
        }

        const redirectOrigin = resolvePublicOrigin(request)
        const emailRedirectTo = `${redirectOrigin}/${locale}/auth/callback?type=signup`
        const supabase = getSupabaseAnon()
        const { error } = await supabase.auth.resend({
            type: 'signup',
            email,
            options: {
                emailRedirectTo,
            },
        })

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[Resend Confirmation] Error:', error)
        return NextResponse.json({ error: apiT(requestLocale, 'failedResendVerification') }, { status: 500 })
    }
}
