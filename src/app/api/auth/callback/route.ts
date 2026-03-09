export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const type = searchParams.get('type') // 'recovery', 'invite', etc.
    const next = searchParams.get('next')
    const locale = searchParams.get('locale') || 'id'

    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error) {
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
