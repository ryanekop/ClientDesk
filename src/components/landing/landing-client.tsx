"use client"

import { useState, useEffect, useCallback } from 'react'
import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import Link from 'next/link'
import { createClient } from "@/utils/supabase/client"
import {
    Loader2, LogOut, Settings, LayoutDashboard, User, Crown,
    Menu, X, ArrowRight
} from "lucide-react"
import { User as SupabaseUser } from "@supabase/supabase-js"
import { useTranslations } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'

function scrollToSection(id: string) {
    const el = document.getElementById(id)
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
}

export function DesktopNav() {
    const t = useTranslations('Landing')
    const navItems = [
        { label: t('navFeatures'), id: 'features' },
        { label: t('navPricing'), id: 'pricing' },
        { label: t('navFaq'), id: 'faq' },
    ]

    return (
        <nav className="hidden md:flex items-center gap-1">
            {navItems.map(item => (
                <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50 cursor-pointer"
                >
                    {item.label}
                </button>
            ))}
        </nav>
    )
}

export function MobileNav() {
    const t = useTranslations('Landing')
    const locale = useLocale()
    const supabase = createClient()
    const [open, setOpen] = useState(false)
    const [user, setUser] = useState<SupabaseUser | null>(null)

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user)
        })
    }, [supabase])

    useEffect(() => {
        if (!open) return
        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement
            if (!target.closest('[data-mobile-nav]')) {
                setOpen(false)
            }
        }
        document.addEventListener('click', handleClick)
        return () => document.removeEventListener('click', handleClick)
    }, [open])

    const handleNav = useCallback((id: string) => {
        setOpen(false)
        setTimeout(() => scrollToSection(id), 100)
    }, [])

    const navItems = [
        { label: t('navFeatures'), id: 'features' },
        { label: t('navPricing'), id: 'pricing' },
        { label: t('navFaq'), id: 'faq' },
    ]

    return (
        <div className="md:hidden" data-mobile-nav>
            <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(!open)}
                className="cursor-pointer"
                aria-label="Toggle menu"
            >
                {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        transition={{
                            type: "spring",
                            stiffness: 500,
                            damping: 40,
                            mass: 0.8,
                        }}
                        className="absolute top-[65px] left-4 right-4 z-50 rounded-2xl border bg-card shadow-xl overflow-hidden"
                    >
                        <div className="p-3">
                            {navItems.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => handleNav(item.id)}
                                    className="w-full text-left px-4 py-4 text-base font-medium text-foreground hover:bg-muted/50 rounded-xl transition-colors cursor-pointer"
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>

                        <div className="p-4 pt-2 border-t space-y-2">
                            {user ? (
                                <Button size="lg" asChild className="w-full gap-2 cursor-pointer">
                                    <Link href={`/${locale}/dashboard`} onClick={() => setOpen(false)}>
                                        {t('dashboard')} <ArrowRight className="h-4 w-4" />
                                    </Link>
                                </Button>
                            ) : (
                                <>
                                    <Button
                                        variant="secondary"
                                        size="lg"
                                        asChild
                                        className="w-full cursor-pointer"
                                    >
                                        <Link href={`/${locale}/register`} onClick={() => setOpen(false)}>
                                            {t('navRegister')}
                                        </Link>
                                    </Button>
                                    <Button
                                        size="lg"
                                        asChild
                                        className="w-full gap-2 cursor-pointer"
                                    >
                                        <Link href={`/${locale}/login`} onClick={() => setOpen(false)}>
                                            {t('navLogin')} <ArrowRight className="h-4 w-4" />
                                        </Link>
                                    </Button>
                                </>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export function LandingNav() {
    const t = useTranslations('Landing')
    const locale = useLocale()
    const router = useRouter()
    const supabase = createClient()
    const [isAuthenticating, setIsAuthenticating] = useState(false)
    const [user, setUser] = useState<SupabaseUser | null>(null)
    const [userName, setUserName] = useState<string>("Admin")
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const handleAuthRedirect = async () => {
            if (typeof window !== 'undefined' && window.location.hash) {
                const hashParams = new URLSearchParams(window.location.hash.substring(1))
                const accessToken = hashParams.get('access_token')
                if (accessToken) {
                    setIsAuthenticating(true)
                    router.push(`/${locale}/auth/callback${window.location.hash}`)
                    return
                }
            }
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                setUser(user)
                const name = user.user_metadata?.full_name || user.email?.split('@')[0] || "Admin"
                setUserName(name)
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('avatar_url, full_name')
                    .eq('id', user.id)
                    .single()
                if (profile) {
                    setAvatarUrl(profile.avatar_url)
                    if (profile.full_name) setUserName(profile.full_name)
                }
            }
        }
        handleAuthRedirect()
    }, [locale, supabase, router])

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }

    const handleLogout = async () => {
        setLoading(true)
        await supabase.auth.signOut()
        setUser(null)
        setAvatarUrl(null)
        router.refresh()
        setLoading(false)
    }

    if (isAuthenticating) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-muted/40">
                <div className="text-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    <p className="text-muted-foreground">Authenticating...</p>
                </div>
            </div>
        )
    }

    return (
        <>
            {user ? (
                <div className="flex items-center gap-2">
                    <Button variant="ghost" className="relative h-9 w-9 rounded-full bg-muted flex items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors overflow-hidden p-0"
                        onClick={() => router.push(`/${locale}/dashboard`)}
                    >
                        {avatarUrl ? (
                            <img src={avatarUrl} alt="Avatar" className="absolute inset-0 w-full h-full object-cover rounded-full" />
                        ) : (
                            <span className="text-xs font-medium">{getInitials(userName)}</span>
                        )}
                    </Button>
                </div>
            ) : (
                <Button variant="outline" asChild className="hidden md:inline-flex">
                    <Link href={`/${locale}/login`}>{t('loginAdmin')}</Link>
                </Button>
            )}
        </>
    )
}

export function HeroCTA() {
    const t = useTranslations('Landing')
    const locale = useLocale()
    const supabase = createClient()
    const [user, setUser] = useState<SupabaseUser | null>(null)

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user)
        })
    }, [supabase])

    return (
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            {user ? (
                <Button size="lg" asChild className="gap-2 cursor-pointer text-lg px-8">
                    <Link href={`/${locale}/dashboard`}>
                        🚀 {t('goToDashboard')} <ArrowRightIcon />
                    </Link>
                </Button>
            ) : (
                <>
                    <Button size="lg" asChild className="gap-2 cursor-pointer text-lg px-8">
                        <Link href={`/${locale}/register`}>
                            🚀 {t('startManaging')} <ArrowRightIcon />
                        </Link>
                    </Button>
                    <Button
                        size="lg"
                        variant="outline"
                        className="gap-2 cursor-pointer text-lg px-8"
                        onClick={() => scrollToSection('features')}
                    >
                        ✨ {t('viewFeatures')}
                    </Button>
                </>
            )}
        </div>
    )
}

export function BottomCTA() {
    const t = useTranslations('Landing')
    const locale = useLocale()
    const supabase = createClient()
    const [user, setUser] = useState<SupabaseUser | null>(null)

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user)
        })
    }, [supabase])

    return (
        <Button size="lg" variant="secondary" asChild className="gap-2 text-lg px-8">
            <Link href={user ? `/${locale}/dashboard` : `/${locale}/register`}>
                🎉 {t('ctaButton')} <ArrowRightIcon />
            </Link>
        </Button>
    )
}

function ArrowRightIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
        </svg>
    )
}
