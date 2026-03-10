"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { useLocale, useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Loader2, Eye, EyeOff, ShieldCheck, CheckCircle } from "lucide-react"
import { LanguageSwitcher } from "@/components/language-switcher"
import { ThemeToggle } from "@/components/theme-toggle"

const inputClass = "placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"

export default function ResetPasswordPage() {
    const router = useRouter()
    const supabase = createClient()
    const locale = useLocale()
    const t = useTranslations("Auth")

    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        if (password !== confirmPassword) {
            setError(t("passwordMismatch"))
            setLoading(false)
            return
        }

        if (password.length < 6) {
            setError(t("passwordMinLength"))
            setLoading(false)
            return
        }

        try {
            const { error } = await supabase.auth.updateUser({
                password,
            })

            if (error) {
                setError(error.message)
                setLoading(false)
                return
            }

            setSuccess(true)
            setTimeout(() => {
                router.push(`/${locale}/dashboard`)
            }, 2000)
        } catch {
            setError(t("genericError"))
            setLoading(false)
        }
    }

    if (success) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
                <div className="w-full max-w-sm">
                    <div className="bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm">
                        <div className="px-6 pt-2 pb-2 text-center space-y-4">
                            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-500/10 flex items-center justify-center">
                                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                            </div>
                            <h2 className="text-xl font-bold">{t("passwordUpdated")}</h2>
                            <p className="text-muted-foreground text-sm">
                                {t("passwordUpdatedDesc")}
                            </p>
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
                            <ShieldCheck className="h-6 w-6" />
                            {t("resetTitle")}
                        </div>
                        <div className="text-muted-foreground text-sm text-center">
                            {t("resetSubtitle")}
                        </div>
                    </div>

                    <div className="px-6">
                        <form onSubmit={handleReset} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium leading-none">{t("newPassword")}</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className={`${inputClass} pr-10`}
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
                            <div className="space-y-2">
                                <label className="text-sm font-medium leading-none">{t("confirmPassword")}</label>
                                <div className="relative">
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className={`${inputClass} pr-10`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
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
                                        {t("saving")}
                                    </>
                                ) : (
                                    <>{t("savePassword")}</>
                                )}
                            </Button>
                        </form>
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
