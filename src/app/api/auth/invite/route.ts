export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )
}

export async function POST(request: Request) {
    try {
        const supabaseAdmin = getSupabaseAdmin()
        const { email } = await request.json()

        if (!email) {
            return NextResponse.json({ error: 'Email wajib diisi' }, { status: 400 })
        }

        // Invite user via magic link
        const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/auth/callback?type=invite&locale=id`
        })

        if (error) {
            console.error('Invite error:', error)
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        return NextResponse.json({ success: true, user: data.user })
    } catch (error) {
        console.error('Invite API error:', error)
        return NextResponse.json({ error: 'Gagal mengirim undangan' }, { status: 500 })
    }
}
