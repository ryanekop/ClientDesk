"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useLocale } from "next-intl"
import { Button } from "@/components/ui/button"
import { Loader2, Eye, EyeOff, UserPlus, Mail, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { Sun, Moon, Languages } from "lucide-react"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

// Use implicit flow so confirmation link works on any device (no PKCE verifier needed)
function createImplicitClient() {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { flowType: 'implicit' } }
    )
}

const inputClass = "placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"

export default function RegisterPage() {
    const router = useRouter()
    const locale = useLocale()
    const { theme, setTheme } = useTheme()

    const [fullName, setFullName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        if (!fullName.trim()) {
            setError("Nama lengkap wajib diisi.")
            setLoading(false)
            return
        }

        if (password !== confirmPassword) {
            setError("Kata sandi tidak cocok.")
            setLoading(false)
            return
        }

        if (password.length < 6) {
            setError("Kata sandi minimal 6 karakter.")
            setLoading(false)
            return
        }

        try {
            // Step 1: Server-side validation (check duplicate email, etc.)
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            })

            const data = await res.json()

            if (!res.ok) {
                setError(data.error || 'Terjadi kesalahan')
                setLoading(false)
                return
            }

            // Step 2: Call signUp with implicit flow for cross-device confirmation
            const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
            const supabase = createImplicitClient()
            const { error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: `${siteUrl}/${locale}/auth/callback?type=signup`,
                    data: {
                        full_name: fullName.trim(),
                    },
                },
            })

            if (signUpError) {
                if (signUpError.message.includes('already registered') || signUpError.message.includes('User already registered')) {
                    setError('Email ini sudah terdaftar. Silakan login.')
                } else {
                    setError(signUpError.message)
                }
                setLoading(false)
                return
            }

            setSuccess(true)
        } catch {
            setError("Terjadi kesalahan, coba lagi.")
        } finally {
            setLoading(false)
        }
    }

    // Success screen
    if (success) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
                <div className="w-full max-w-sm">
                    <div className="bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm">
                        <div className="px-6 pt-2 pb-2 text-center space-y-4">
                            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                                <Mail className="h-8 w-8 text-primary" />
                            </div>
                            <h2 className="text-xl font-bold">Cek Email Anda</h2>
                            <p className="text-muted-foreground text-sm">
                                Kami telah mengirimkan link konfirmasi ke email Anda. Klik link tersebut untuk mengaktifkan akun.
                            </p>
                            <p className="text-xs text-muted-foreground font-mono bg-muted rounded-md px-3 py-2">
                                {email}
                            </p>
                            <Button variant="outline" className="w-full mt-4 cursor-pointer" asChild>
                                <Link href={`/${locale}/login`}>
                                    <ArrowLeft className="h-4 w-4 mr-2" />
                                    Kembali ke Login
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
                    {/* Header */}
                    <div className="grid auto-rows-min items-start gap-2 px-6">
                        <div className="leading-none font-semibold text-2xl text-center flex items-center justify-center gap-2">
                            <UserPlus className="h-6 w-6" />
                            Daftar Akun
                        </div>
                        <div className="text-muted-foreground text-sm text-center">
                            Buat akun baru untuk mengakses ClientDesk
                        </div>
                    </div>

                    {/* Form */}
                    <div className="px-6">
                        <form onSubmit={handleRegister} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium leading-none">Nama Lengkap</label>
                                <input
                                    type="text"
                                    placeholder="Nama Studio / Nama Anda"
                                    required
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className={inputClass}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium leading-none">Email</label>
                                <input
                                    type="email"
                                    placeholder="email@example.com"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className={inputClass}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium leading-none">Kata Sandi</label>
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
                                <label className="text-sm font-medium leading-none">Konfirmasi Kata Sandi</label>
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

                            <Button type="submit" className="w-full cursor-pointer hover:opacity-90 transition-opacity" disabled={loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Mendaftar...
                                    </>
                                ) : (
                                    <>Daftar</>
                                )}
                            </Button>
                        </form>

                        {/* Already have account */}
                        <div className="mt-6 pt-6 border-t text-center space-y-3">
                            <p className="text-sm text-muted-foreground">Sudah punya akun?</p>
                            <Button variant="outline" className="w-full gap-2 cursor-pointer" asChild>
                                <Link href={`/${locale}/login`}>
                                    Masuk
                                </Link>
                            </Button>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center px-6 justify-center gap-2">
                        <button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-9 w-9 cursor-pointer">
                            <Languages className="h-[1.2rem] w-[1.2rem]" />
                        </button>
                        <button
                            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-9 w-9 cursor-pointer"
                        >
                            {theme === "dark" ? <Moon className="h-[1.2rem] w-[1.2rem]" /> : <Sun className="h-[1.2rem] w-[1.2rem]" />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
