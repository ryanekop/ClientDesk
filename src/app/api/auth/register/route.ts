export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveApiLocale } from '@/lib/i18n/api-locale'
import { apiT } from '@/lib/i18n/api-errors'

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )
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
    const locale = resolveApiLocale(request)

    try {
        const { email, captchaToken } = await request.json()

        if (!email) {
            return NextResponse.json({ error: apiT(locale, 'emailRequired') }, { status: 400 })
        }

        // Verify Cloudflare Turnstile captcha
        if (!captchaToken) {
            return NextResponse.json({ error: apiT(locale, 'captchaNotVerified') }, { status: 400 })
        }

        const turnstileRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                secret: process.env.TURNSTILE_SECRET_KEY,
                response: captchaToken,
                remoteip: request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '',
            }),
        })

        const turnstileData = await turnstileRes.json()
        if (!turnstileData.success) {
            return NextResponse.json({ error: apiT(locale, 'captchaVerificationFailed') }, { status: 400 })
        }

        // Check if email already registered using admin API
        const existingUser = await findAuthUserByEmail(email)

        if (existingUser) {
            if (existingUser.email_confirmed_at) {
                return NextResponse.json({ error: apiT(locale, 'emailAlreadyRegisteredPleaseLogin') }, { status: 409 })
            }

            return NextResponse.json({
                error: apiT(locale, 'emailNotConfirmedResend'),
                status: 'unconfirmed',
            }, { status: 409 })
        }

        return NextResponse.json({ valid: true, status: 'available' })
    } catch (error) {
        console.error('[Register] Validate error:', error)
        return NextResponse.json({ error: apiT(locale, 'validationUnexpectedError') }, { status: 500 })
    }
}
