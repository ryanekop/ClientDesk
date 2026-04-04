"use client"

import { useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageSwitcher } from "@/components/language-switcher"
import { useTenant } from "@/lib/tenant-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from 'next/link'
import { Check, Star, Zap, Crown, Infinity as InfinityIcon, ArrowLeft } from "lucide-react"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { createClient } from '@/utils/supabase/client'

import { LandingNav } from "@/components/landing/landing-client"
import { TenantLogo } from "@/components/layout/tenant-logo"

type PricingMode = "single" | "bundle"

const CLIENT_DESK_CHECKOUT_LINK = "https://ryaneko.myr.id/m/client-desk-pro-access"
const BUNDLE_CHECKOUT_LINK = "https://ryaneko.myr.id/m/bundling-client-desk-fastpik/"

export default function PricingPage() {
    const t = useTranslations('Pricing')
    const tl = useTranslations('Landing')
    const locale = useLocale()
    const tenant = useTenant()
    const supabase = createClient()
    const [currentTier, setCurrentTier] = useState<string | null>(null)
    const [pricingMode, setPricingMode] = useState<PricingMode>("single")

    useEffect(() => {
        async function fetchSubscription() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const { data: sub } = await supabase
                .from('subscriptions')
                .select('tier, status')
                .eq('user_id', user.id)
                .maybeSingle()
            if (sub && sub.status !== 'expired') {
                setCurrentTier(sub.tier)
            }
        }
        fetchSubscription()
    }, [])

    const sharedFeatures = [
        "featureFullAccess",
        "featureUnlimitedBooking",
        "featureWhatsApp",
        "featureInvoice",
        "featureCalendar",
        "featureDrive",
        "featurePrioritySupport"
    ]

    const bundleExtraFeatures = pricingMode === "bundle"
        ? ["featureBundleAllFastpik", "featureBundleSyncFastpik"]
        : []

    const plans = [
        {
            nameKey: "plan1Month",
            tier: "pro_monthly",
            price: pricingMode === "bundle" ? "49rb" : "39rb",
            durationKey: "perMonth",
            features: [...bundleExtraFeatures, ...sharedFeatures],
            link: pricingMode === "bundle" ? BUNDLE_CHECKOUT_LINK : CLIENT_DESK_CHECKOUT_LINK,
            popular: false,
            icon: Zap,
            isLifetime: false
        },
        {
            nameKey: "plan3Months",
            tier: "pro_quarterly",
            price: pricingMode === "bundle" ? "125rb" : "99rb",
            durationKey: "per3Months",
            features: [
                pricingMode === "bundle" ? "featurePerMonthBundle3" : "featurePerMonth3",
                ...bundleExtraFeatures,
                ...sharedFeatures
            ],
            link: pricingMode === "bundle" ? BUNDLE_CHECKOUT_LINK : CLIENT_DESK_CHECKOUT_LINK,
            popular: false,
            icon: Star,
            isLifetime: false
        },
        {
            nameKey: "plan1Year",
            tier: "pro_yearly",
            price: pricingMode === "bundle" ? "399rb" : "349rb",
            durationKey: "perYear",
            features: [
                pricingMode === "bundle" ? "featurePerMonthBundle12" : "featurePerMonth12",
                ...bundleExtraFeatures,
                ...sharedFeatures
            ],
            link: pricingMode === "bundle" ? BUNDLE_CHECKOUT_LINK : CLIENT_DESK_CHECKOUT_LINK,
            popular: true,
            icon: Crown,
            isLifetime: false
        },
        {
            nameKey: "planLifetime",
            tier: "lifetime",
            price: pricingMode === "bundle" ? "749rb" : "549rb",
            durationKey: "oneTime",
            features: ["featurePayOnce", ...bundleExtraFeatures, "featureLimitedSlot", ...sharedFeatures, "featureFutureUpdates"],
            link: pricingMode === "bundle" ? BUNDLE_CHECKOUT_LINK : CLIENT_DESK_CHECKOUT_LINK,
            popular: false,
            icon: InfinityIcon,
            isLifetime: true
        }
    ]

    return (
        <div className="flex flex-col min-h-screen font-sans">
            <header className="sticky announcement-aware-sticky z-50 flex items-center justify-between p-4 border-b bg-background/80 backdrop-blur-sm">
                <Link href={`/${locale}`} className="font-bold text-xl tracking-tight flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <TenantLogo
                        src={tenant.logoUrl}
                        alt={tenant.name}
                        width={32}
                        height={32}
                        className="h-8 w-8 rounded-lg"
                    />
                    {tenant.name}
                </Link>
                <div className="flex items-center gap-2">
                    <LanguageSwitcher />
                    <ThemeToggle />
                    <LandingNav />
                </div>
            </header>

            <main className="flex-1 container mx-auto px-4 py-16">
                {/* Back button */}
                <div className="text-center mb-8">
                    <Button variant="ghost" size="sm" asChild className="gap-1">
                        <Link href={`/${locale}`}>
                            <ArrowLeft className="h-4 w-4" /> Home
                        </Link>
                    </Button>
                </div>

                <div className="text-center space-y-4 mb-16">
                    <Badge variant="secondary" className="mb-4">{t('specialOffer')}</Badge>
                    <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
                        {t('pageTitle').split('Client Desk')[0]}
                        <span className="text-primary">Client Desk</span>
                        {t('pageTitle').split('Client Desk')[1] || ''}
                    </h1>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                        {t('pageDescription')}
                    </p>

                    <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4 max-w-3xl mx-auto mt-8">
                        <h3 className="font-bold text-yellow-600 dark:text-yellow-400 flex items-center justify-center gap-2">
                            <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
                            {t('trialTitle')}
                        </h3>
                        <p className="text-muted-foreground mt-2">
                            {t('trialDescription')}
                        </p>
                    </div>
                </div>

                <div className="mb-10 flex flex-col items-center gap-3">
                    <div className="inline-flex items-center rounded-full border bg-muted p-1">
                        <button
                            type="button"
                            onClick={() => setPricingMode("single")}
                            className={cn(
                                "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                                pricingMode === "single"
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {t("modeSingleLabel")}
                        </button>
                        <button
                            type="button"
                            onClick={() => setPricingMode("bundle")}
                            className={cn(
                                "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                                pricingMode === "bundle"
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {t("modeBundleLabel")}
                        </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {t("crossProductHint")}{" "}
                        <a
                            href={`https://fastpik.ryanekoapp.web.id/${locale}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-primary hover:underline"
                        >
                            {t("crossProductLinkLabel")}
                        </a>
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
                    {plans.map((plan) => {
                        const isActive = currentTier === plan.tier
                        return (
                            <Card key={plan.nameKey} className={cn(
                                "flex flex-col relative",
                                plan.popular ? "border-primary shadow-lg scale-105 z-10" : "border-border",
                                isActive && "border-green-500 border-2 ring-2 ring-green-500/25"
                            )}>
                                {isActive && (
                                    <div className="absolute -top-4 left-0 right-0 flex justify-center">
                                        <Badge className="bg-green-500 text-white px-3 py-1 flex items-center gap-1.5">
                                            <Check className="h-3.5 w-3.5" />
                                            {t('currentPlan')}
                                        </Badge>
                                    </div>
                                )}
                                {!isActive && plan.popular && (
                                    <div className="absolute -top-4 left-0 right-0 flex justify-center">
                                        <Badge className="bg-primary text-primary-foreground px-3 py-1">{t('mostPopular')}</Badge>
                                    </div>
                                )}
                                <CardHeader>
                                    <div className="flex items-center gap-2 mb-2">
                                        <plan.icon className={cn("h-5 w-5", isActive ? "text-green-500" : plan.popular ? "text-primary" : "text-muted-foreground")} />
                                        <CardTitle className="text-xl">{t(plan.nameKey)}</CardTitle>
                                    </div>
                                    <div className="flex items-end gap-2">
                                        <div className="flex flex-col">
                                            <span className="text-3xl font-bold">{plan.price}</span>
                                        </div>
                                        <span className="text-muted-foreground text-sm mb-1">{t(plan.durationKey)}</span>
                                    </div>
                                    <CardDescription>
                                        {plan.isLifetime ? t('billingOnce') : t('billingManualRenew')}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex-1">
                                    <ul className="space-y-3">
                                        {plan.features.map((featureKey) => (
                                            <li key={featureKey} className="flex items-center gap-2">
                                                <Check className="h-4 w-4 text-green-500 shrink-0" />
                                                <span className="text-sm text-muted-foreground">{t(featureKey)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                                <CardFooter>
                                    {isActive ? (
                                        <Button className="w-full" variant="outline" disabled>
                                            <Check className="h-4 w-4 mr-2" />
                                            {t('currentPlan')}
                                        </Button>
                                    ) : (
                                        <Button className="w-full cursor-pointer" variant={plan.popular ? "default" : "outline"} asChild>
                                            <a href={plan.link}>
                                                {t('selectPlan')}
                                            </a>
                                        </Button>
                                    )}
                                </CardFooter>
                            </Card>
                        )
                    })}
                </div>

                <div className="mt-16 text-center">
                    <p className="text-muted-foreground text-sm">
                        {t('paymentNote')}
                        <br />
                        {t('paymentMethods')}
                    </p>
                </div>
            </main>

            <footer className="py-8 border-t text-center text-sm text-muted-foreground">
                {tenant.footerText ? (
                    <p dangerouslySetInnerHTML={{ __html: tenant.footerText }} />
                ) : (
                    <p>
                        © {new Date().getFullYear()} {tenant.name}. {tl('footerMadeWith')} <a href="https://instagram.com/ryanekopram" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@ryanekopram</a> & <a href="https://instagram.com/ryanekoapps" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@ryanekoapps</a>
                    </p>
                )}
            </footer>
        </div>
    )
}
