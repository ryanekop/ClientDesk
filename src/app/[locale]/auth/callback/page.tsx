"use client"

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useLocale } from 'next-intl'
import { Loader2 } from 'lucide-react'

export default function AuthCallbackPage() {
    const router = useRouter()
    const locale = useLocale()
    const supabase = createClient()
    const searchParams = useSearchParams()
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const handleAuthCallback = async () => {
            try {
                // Check for PKCE code in URL query params
                const code = searchParams.get('code')
                const type = searchParams.get('type') || ''

                // Check hash for implicit flow
                const hashParams = new URLSearchParams(
                    window.location.hash.substring(1)
                )
                const accessToken = hashParams.get('access_token')
                const refreshToken = hashParams.get('refresh_token')
                const hashType = hashParams.get('type')
                const hashError = hashParams.get('error')
                const errorDescription = hashParams.get('error_description')

                const authType = type || hashType || ''

                if (hashError) {
                    setError(errorDescription || hashError)
                    return
                }

                // Handle PKCE flow
                if (code) {
                    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
                    if (exchangeError) {
                        setError(exchangeError.message)
                        return
                    }

                    // Auto-create trial subscription for new users
                    const { data: { user } } = await supabase.auth.getUser()
                    if (user) {
                        fetch('/api/auth/callback', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                userId: user.id,
                                email: user.email,
                                fullName: user.user_metadata?.full_name || '',
                            }),
                        }).catch(() => { })
                    }

                    if (authType === 'recovery' || authType === 'invite') {
                        window.location.href = `/${locale}/reset-password`
                    } else {
                        window.location.href = `/${locale}/dashboard`
                    }
                    return
                }

                // Handle implicit flow (tokens in hash)
                if (accessToken && refreshToken) {
                    const { error: sessionError } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken
                    })

                    if (sessionError) {
                        setError(sessionError.message)
                        return
                    }

                    // Auto-create trial subscription for new users
                    const { data: { user: implicitUser } } = await supabase.auth.getUser()
                    if (implicitUser) {
                        fetch('/api/auth/callback', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                userId: implicitUser.id,
                                email: implicitUser.email,
                                fullName: implicitUser.user_metadata?.full_name || '',
                            }),
                        }).catch(() => { })
                    }

                    if (authType === 'invite' || authType === 'recovery') {
                        window.location.href = `/${locale}/reset-password`
                    } else {
                        window.location.href = `/${locale}/dashboard`
                    }
                    return
                }

                // No code or tokens, check if already authenticated
                const { data: { user } } = await supabase.auth.getUser()
                if (user) {
                    if (authType === 'recovery' || authType === 'invite') {
                        window.location.href = `/${locale}/reset-password`
                    } else {
                        window.location.href = `/${locale}/dashboard`
                    }
                } else {
                    setError('Token autentikasi tidak ditemukan. Coba klik link lagi atau minta link baru.')
                }
            } catch {
                setError('Gagal mengautentikasi. Silakan coba lagi.')
            }
        }

        handleAuthCallback()
    }, [locale, searchParams, supabase.auth])

    if (error) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
                <div className="w-full max-w-sm space-y-4 text-center">
                    <div className="p-4 bg-destructive/15 text-destructive rounded-md">
                        <p className="font-medium">Kesalahan Autentikasi</p>
                        <p className="text-sm mt-1">{error}</p>
                    </div>
                    <button
                        onClick={() => window.location.href = `/${locale}/login`}
                        className="text-primary hover:underline text-sm cursor-pointer"
                    >
                        Kembali ke Login
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-muted/40">
            <div className="text-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <p className="text-muted-foreground">Mengautentikasi...</p>
            </div>
        </div>
    )
}
