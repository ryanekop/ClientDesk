"use client"

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useLocale, useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

type ErrorAction = 'forgot-password' | 'register' | null

export default function AuthCallbackPage() {
    const locale = useLocale()
    const supabase = createClient()
    const searchParams = useSearchParams()
    const t = useTranslations('Auth')
    const [error, setError] = useState<string | null>(null)
    const [errorAction, setErrorAction] = useState<ErrorAction>(null)

    const getErrorAction = (message: string, authType: string): ErrorAction => {
        const normalizedMessage = message.toLowerCase()
        if (authType === 'signup') {
            return 'register'
        }
        if (
            authType === 'recovery' ||
            authType === 'invite' ||
            normalizedMessage.includes('expired') ||
            normalizedMessage.includes('invalid token') ||
            normalizedMessage.includes('token')
        ) {
            return 'forgot-password'
        }

        return null
    }

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
                    const message = errorDescription || hashError
                    setError(message)
                    setErrorAction(getErrorAction(message, authType))
                    return
                }

                // Handle PKCE flow
                if (code) {
                    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
                    if (exchangeError) {
                        setError(exchangeError.message)
                        setErrorAction(getErrorAction(exchangeError.message, authType))
                        return
                    }

                    // Auto-create trial subscription for new users
                    const { data: { user } } = await supabase.auth.getUser()
                    if (user) {
                        await fetch('/api/auth/callback', {
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
                        await fetch('/api/auth/callback', {
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
                    setError(t('authTokenNotFound'))
                    setErrorAction(getErrorAction(t('authTokenNotFound'), authType))
                }
            } catch {
                setError(t('authFailed'))
            }
        }

        handleAuthCallback()
    }, [locale, searchParams, supabase.auth, t])

    if (error) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
                <div className="w-full max-w-sm space-y-4 text-center">
                    <div className="p-4 bg-destructive/15 text-destructive rounded-md">
                        <p className="font-medium">{t('authError')}</p>
                        <p className="text-sm mt-1">{error}</p>
                    </div>
                    <button
                        onClick={() => window.location.href = `/${locale}/login`}
                        className="text-primary hover:underline text-sm cursor-pointer"
                    >
                        {t('backToLogin')}
                    </button>
                    {errorAction === 'forgot-password' && (
                        <button
                            onClick={() => window.location.href = `/${locale}/forgot-password`}
                            className="block w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                        >
                            {t('requestNewResetLink')}
                        </button>
                    )}
                    {errorAction === 'register' && (
                        <button
                            onClick={() => window.location.href = `/${locale}/register`}
                            className="block w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                        >
                            {t('requestNewVerificationLink')}
                        </button>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-muted/40">
            <div className="text-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <p className="text-muted-foreground">{t('authenticating')}</p>
            </div>
        </div>
    )
}
