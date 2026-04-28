"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Loader2, Eye, EyeOff, UserPlus, Lock, Send } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { LanguageSwitcher } from "@/components/language-switcher"
import { ThemeToggle } from "@/components/theme-toggle"
import {
    applyClientDeskRememberMeSelection,
    clearClientDeskSessionOnlyState,
    evaluateClientDeskSessionOnlyState,
} from "@/lib/auth/session-only"
import { AppCheckbox } from "@/components/ui/app-checkbox"
import { getClientDeskRegisterHref } from "@/lib/auth/register-url"
import { Turnstile } from "@marsidev/react-turnstile"

type LoginHandoffTarget = {
    origin: string
    returnPath: string
}

type LoginFormProps = {
    handoffTarget?: LoginHandoffTarget | null
    handoffError?: boolean
    accountUnavailable?: boolean
}

function buildHandoffCallbackUrl(args: {
    origin: string
    locale: string
    returnPath: string
    accessToken: string
    refreshToken: string
    rememberMe: boolean
}) {
    const callbackUrl = new URL(`/${args.locale}/auth/callback`, args.origin)
    callbackUrl.searchParams.set("type", "login")
    callbackUrl.searchParams.set("next", args.returnPath)

    const hashParams = new URLSearchParams()
    hashParams.set("access_token", args.accessToken)
    hashParams.set("refresh_token", args.refreshToken)
    hashParams.set("type", "login")
    hashParams.set("remember_me", args.rememberMe ? "true" : "false")
    callbackUrl.hash = hashParams.toString()

    return callbackUrl.toString()
}

export function LoginForm({ handoffTarget, handoffError = false, accountUnavailable = false }: LoginFormProps) {
    const router = useRouter()
    const supabase = createClient()
    const locale = useLocale()
    const t = useTranslations("Auth")
    const registerHref = getClientDeskRegisterHref(locale)

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [rememberMe, setRememberMe] = useState(true)
    const [captchaToken, setCaptchaToken] = useState("")
    const [captchaKey, setCaptchaKey] = useState(0)
    const [loading, setLoading] = useState(false)
    const [autoHandoffChecking, setAutoHandoffChecking] = useState(Boolean(handoffTarget && !handoffError))
    const [resending, setResending] = useState(false)
    const [error, setError] = useState<string | null>(
        handoffError
            ? t("authHandoffExpired")
            : accountUnavailable
                ? t("accountAccessUnavailable")
                : null,
    )
    const [feedbackTone, setFeedbackTone] = useState<"error" | "success">("error")
    const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null)
    const rememberMeId = "remember-me"

    useEffect(() => {
        if (!handoffTarget || handoffError) {
            setAutoHandoffChecking(false)
            return
        }

        let cancelled = false

        const attemptExistingSessionHandoff = async () => {
            setAutoHandoffChecking(true)

            const {
                data: { session },
                error: sessionError,
            } = await supabase.auth.getSession()

            if (cancelled) return

            if (sessionError || !session?.access_token || !session.refresh_token) {
                setAutoHandoffChecking(false)
                return
            }

            const { shouldSignOut, sessionOnlyActive } =
                evaluateClientDeskSessionOnlyState(session.user.id)

            if (shouldSignOut) {
                clearClientDeskSessionOnlyState()
                await supabase.auth.signOut()

                if (!cancelled) {
                    setAutoHandoffChecking(false)
                }
                return
            }

            window.location.replace(buildHandoffCallbackUrl({
                origin: handoffTarget.origin,
                locale,
                returnPath: handoffTarget.returnPath,
                accessToken: session.access_token,
                refreshToken: session.refresh_token,
                rememberMe: !sessionOnlyActive,
            }))
        }

        attemptExistingSessionHandoff()

        return () => {
            cancelled = true
        }
    }, [handoffError, handoffTarget, locale, supabase.auth])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setFeedbackTone("error")
        setUnconfirmedEmail(null)

        try {
            const blockCheckRes = await fetch('/api/auth/blocked-login-attempt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            })
            const blockCheckData = await blockCheckRes.json().catch(() => null) as {
                blocked?: boolean
                error?: string
            } | null

            if (blockCheckData?.blocked || blockCheckRes.status === 403) {
                setCaptchaToken("")
                setCaptchaKey((value) => value + 1)
                setError(blockCheckData?.error || t("accountAccessUnavailable"))
                setLoading(false)
                return
            }

            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
                options: {
                    captchaToken,
                },
            })

            if (error) {
                setCaptchaToken("")
                setCaptchaKey((value) => value + 1)

                if (error.message.toLowerCase().includes('invalid login credentials')) {
                    setError(t("invalidCredentials"))
                } else if (error.message.toLowerCase().includes('email not confirmed')) {
                    setError(t("emailNotConfirmedResend"))
                    setUnconfirmedEmail(email.trim())
                } else {
                    setError(error.message)
                }
                setLoading(false)
                return
            }

            applyClientDeskRememberMeSelection(rememberMe)

            const accessToken = data.session?.access_token || ""
            const refreshToken = data.session?.refresh_token || ""
            if (handoffTarget && accessToken && refreshToken) {
                window.location.href = buildHandoffCallbackUrl({
                    origin: handoffTarget.origin,
                    locale,
                    returnPath: handoffTarget.returnPath,
                    accessToken,
                    refreshToken,
                    rememberMe,
                })
                return
            }

            router.refresh()
            router.push(`/${locale}/dashboard`)
        } catch {
            setError(t("genericError"))
            setCaptchaToken("")
            setCaptchaKey((value) => value + 1)
            setLoading(false)
        }
    }

    const handleResendVerification = async () => {
        const targetEmail = unconfirmedEmail || email.trim()
        if (!targetEmail) return

        setResending(true)
        setError(null)
        setFeedbackTone("error")

        try {
            const res = await fetch("/api/auth/resend-confirmation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: targetEmail, captchaToken, locale }),
            })
            const data = await res.json()

            if (!res.ok) {
                setError(data.error || t("resendVerificationFailed"))
                setCaptchaToken("")
                setCaptchaKey((value) => value + 1)
                return
            }

            setError(t("resendVerificationSent"))
            setFeedbackTone("success")
            setUnconfirmedEmail(null)
        } catch {
            setError(t("resendVerificationFailed"))
            setCaptchaToken("")
            setCaptchaKey((value) => value + 1)
        } finally {
            setResending(false)
        }
    }

    if (autoHandoffChecking) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
                <div className="bg-card text-card-foreground flex w-full max-w-sm flex-col items-center justify-center gap-4 rounded-xl border p-8 text-center shadow-sm">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">{t("authenticating")}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
            <div className="w-full max-w-sm space-y-4">
                <div className="bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm">
                    <div className="grid auto-rows-min items-start gap-2 px-6">
                        <div className="leading-none font-semibold text-2xl font-bold text-center flex items-center justify-center gap-2">
                            <Lock className="h-6 w-6" />
                            {t("loginTitle")}
                        </div>
                        <div className="text-muted-foreground text-sm text-center">
                            {t("loginSubtitle")}
                        </div>
                    </div>

                    <div className="px-6">
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium leading-none">{t("email")}</label>
                                <input
                                    type="email"
                                    placeholder="admin@example.com"
                                    required
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value)
                                        setUnconfirmedEmail(null)
                                    }}
                                    className="placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium leading-none">{t("password")}</label>
                                    <Link href={`/${locale}/forgot-password`} className="text-xs text-primary hover:underline cursor-pointer">{t("forgotPassword")}</Link>
                                </div>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 pr-10 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center space-x-2">
                                <AppCheckbox
                                    id={rememberMeId}
                                    checked={rememberMe}
                                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                                />
                                <label
                                    htmlFor={rememberMeId}
                                    className="text-sm font-normal cursor-pointer leading-none"
                                >
                                    {t("rememberMe")}
                                </label>
                            </div>

                            {error && (
                                <div className={`space-y-3 rounded-md p-3 text-sm ${feedbackTone === "success" ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-destructive/15 text-destructive"}`}>
                                    <p>{error}</p>
                                    {unconfirmedEmail && (
                                        <div className="space-y-3 text-foreground">
                                            <p className="text-xs text-muted-foreground">
                                                {t("resendVerificationHint")}
                                            </p>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="w-full gap-2 bg-background"
                                                disabled={resending || !captchaToken}
                                                onClick={handleResendVerification}
                                            >
                                                {resending ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        {t("sending")}
                                                    </>
                                                ) : (
                                                    <>
                                                        <Send className="h-4 w-4" />
                                                        {t("resendVerification")}
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}

                            <Turnstile
                                key={captchaKey}
                                siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
                                onSuccess={(token) => setCaptchaToken(token)}
                                onExpire={() => setCaptchaToken("")}
                                onError={() => setCaptchaToken("")}
                                options={{ theme: 'auto', size: 'flexible' }}
                            />

                            <Button type="submit" className="w-full hover:opacity-90 transition-opacity" disabled={loading || !captchaToken}>
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {t("processing")}
                                    </>
                                ) : (
                                    <>{t("login")}</>
                                )}
                            </Button>
                        </form>

                        <div className="mt-6 pt-6 border-t text-center space-y-3">
                            <p className="text-sm text-muted-foreground">{t("noAccount")}</p>
                            <Button variant="outline" className="w-full gap-2" asChild>
                                <Link href={registerHref}>
                                    <UserPlus className="h-4 w-4" />
                                    {t("registerNow")}
                                </Link>
                            </Button>
                        </div>
                    </div>

                    <div className="flex items-center px-6 justify-center gap-2">
                        <LanguageSwitcher />
                        <ThemeToggle />
                    </div>
                </div>
            </div>
        </div>
    )
}
