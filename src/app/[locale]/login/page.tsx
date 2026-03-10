"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Loader2, Eye, EyeOff, UserPlus, Lock } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { LanguageSwitcher } from "@/components/language-switcher"
import { ThemeToggle } from "@/components/theme-toggle"

export default function LoginPage() {
    const router = useRouter()
    const supabase = createClient()
    const locale = useLocale()
    const t = useTranslations("Auth")

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [rememberMe, setRememberMe] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (error) {
                if (error.message.toLowerCase().includes('invalid login credentials')) {
                    setError(t("invalidCredentials"))
                } else {
                    setError(error.message)
                }
                setLoading(false)
                return
            }

            router.refresh()
            router.push(`/${locale}/dashboard`)
        } catch {
            setError(t("genericError"))
            setLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
            <div className="w-full max-w-sm space-y-4">
                {/* Card */}
                <div className="bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm">
                    {/* Card Header */}
                    <div className="grid auto-rows-min items-start gap-2 px-6">
                        <div className="leading-none font-semibold text-2xl font-bold text-center flex items-center justify-center gap-2">
                            <Lock className="h-6 w-6" />
                            {t("loginTitle")}
                        </div>
                        <div className="text-muted-foreground text-sm text-center">
                            {t("loginSubtitle")}
                        </div>
                    </div>

                    {/* Card Content */}
                    <div className="px-6">
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium leading-none">{t("email")}</label>
                                <input
                                    type="email"
                                    placeholder="admin@example.com"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
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
                                <button
                                    type="button"
                                    role="checkbox"
                                    aria-checked={rememberMe}
                                    data-state={rememberMe ? "checked" : "unchecked"}
                                    onClick={() => setRememberMe(!rememberMe)}
                                    className="peer border-input dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] cursor-pointer"
                                >
                                    {rememberMe && (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="grid place-content-center text-current"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    )}
                                </button>
                                <label
                                    onClick={() => setRememberMe(!rememberMe)}
                                    className="text-sm font-normal cursor-pointer leading-none"
                                >
                                    {t("rememberMe")}
                                </label>
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
                                        {t("processing")}
                                    </>
                                ) : (
                                    <>{t("login")}</>
                                )}
                            </Button>
                        </form>

                        {/* No Account Section */}
                        <div className="mt-6 pt-6 border-t text-center space-y-3">
                            <p className="text-sm text-muted-foreground">{t("noAccount")}</p>
                            <Button variant="outline" className="w-full gap-2" asChild>
                                <Link href={`/${locale}/register`}>
                                    <UserPlus className="h-4 w-4" />
                                    {t("registerNow")}
                                </Link>
                            </Button>
                        </div>
                    </div>

                    {/* Card Footer */}
                    <div className="flex items-center px-6 justify-center gap-2">
                        <LanguageSwitcher />
                        <ThemeToggle />
                    </div>
                </div>
            </div>
        </div>
    )
}
