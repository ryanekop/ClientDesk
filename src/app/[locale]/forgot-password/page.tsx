"use client"

import { useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { useLocale, useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Loader2, Mail, ArrowLeft, KeyRound } from "lucide-react"
import Link from "next/link"
import { LanguageSwitcher } from "@/components/language-switcher"
import { ThemeToggle } from "@/components/theme-toggle"

const inputClass = "placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"

export default function ForgotPasswordPage() {
    const supabase = createClient()
    const locale = useLocale()
    const t = useTranslations("Auth")

    const [email, setEmail] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${siteUrl}/api/auth/callback?type=recovery&locale=${locale}`,
            })

            if (error) {
                setError(error.message)
                setLoading(false)
                return
            }

            setSuccess(true)
        } catch {
            setError(t("genericError"))
        } finally {
            setLoading(false)
        }
    }

    if (success) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
                <div className="w-full max-w-sm">
                    <div className="bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm">
                        <div className="px-6 pt-2 pb-2 text-center space-y-4">
                            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                                <Mail className="h-8 w-8 text-primary" />
                            </div>
                            <h2 className="text-xl font-bold">{t("checkEmail")}</h2>
                            <p className="text-muted-foreground text-sm">
                                {t("resetEmailSent")}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono bg-muted rounded-md px-3 py-2">
                                {email}
                            </p>
                            <Button variant="outline" className="w-full mt-4" asChild>
                                <Link href={`/${locale}/login`}>
                                    <ArrowLeft className="h-4 w-4 mr-2" />
                                    {t("backToLogin")}
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
            <div className="w-full max-w-sm space-y-4">
                <div className="bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm">
                    <div className="grid auto-rows-min items-start gap-2 px-6">
                        <div className="leading-none font-semibold text-2xl text-center flex items-center justify-center gap-2">
                            <KeyRound className="h-6 w-6" />
                            {t("forgotTitle")}
                        </div>
                        <div className="text-muted-foreground text-sm text-center">
                            {t("forgotSubtitle")}
                        </div>
                    </div>

                    <div className="px-6">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium leading-none">{t("email")}</label>
                                <input
                                    type="email"
                                    placeholder="admin@example.com"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className={inputClass}
                                />
                            </div>

                            {error && (
                                <div className="p-3 bg-destructive/15 text-destructive text-sm rounded-md">
                                    {error}
                                </div>
                            )}

                            <Button type="submit" className="w-full hover:opacity-90 transition-opacity" disabled={loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {t("sending")}
                                    </>
                                ) : (
                                    <>{t("sendResetLink")}</>
                                )}
                            </Button>
                        </form>

                        <div className="mt-6 pt-6 border-t text-center">
                            <Button variant="outline" className="w-full gap-2" asChild>
                                <Link href={`/${locale}/login`}>
                                    <ArrowLeft className="h-4 w-4" />
                                    {t("backToLogin")}
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
