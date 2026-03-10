"use client"

import { useTranslations, useLocale } from 'next-intl'
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageSwitcher } from "@/components/language-switcher"
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

export default function PricingPage() {
    const t = useTranslations('Pricing')
    const tl = useTranslations('Landing')
    const locale = useLocale()

    const plans = [
        {
            nameKey: "plan1Month",
            price: "39rb",
            durationKey: "perMonth",
            features: [
                "featureFullAccess",
                "featureUnlimitedBooking",
                "featureWhatsApp",
                "featureInvoice",
                "featurePrioritySupport"
            ],
            link: "#",
            popular: false,
            icon: Zap,
            isLifetime: false
        },
        {
            nameKey: "plan3Months",
            price: "99rb",
            durationKey: "per3Months",
            features: [
                "featureSave30",
                "featureFullAccess",
                "featureUnlimitedBooking",
                "featureWhatsApp",
                "featureInvoice",
                "featurePrioritySupport"
            ],
            link: "#",
            popular: false,
            icon: Star,
            isLifetime: false
        },
        {
            nameKey: "plan1Year",
            price: "349rb",
            durationKey: "perYear",
            features: [
                "featureSave50",
                "featureFullAccess",
                "featureUnlimitedBooking",
                "featureWhatsApp",
                "featureInvoice",
                "featureCalendar",
                "featureDrive",
                "featurePrioritySupport"
            ],
            link: "#",
            popular: true,
            icon: Crown,
            isLifetime: false
        },
        {
            nameKey: "planLifetime",
            price: "549rb",
            durationKey: "oneTime",
            features: [
                "featurePayOnce",
                "featureFullAccess",
                "featureUnlimitedBooking",
                "featureWhatsApp",
                "featureInvoice",
                "featureCalendar",
                "featureDrive",
                "featurePrioritySupport",
                "featureFutureUpdates"
            ],
            link: "#",
            popular: false,
            icon: InfinityIcon,
            isLifetime: true
        }
    ]

    return (
        <div className="flex flex-col min-h-screen font-[family-name:var(--font-geist-sans)]">
            <header className="sticky top-0 z-50 flex items-center justify-between p-4 border-b bg-background/80 backdrop-blur-sm">
                <Link href={`/${locale}`} className="font-bold text-xl tracking-tight flex items-center gap-3 hover:opacity-80 transition-opacity">
                    Client Desk
                </Link>
                <div className="flex items-center gap-2">
                    <LanguageSwitcher />
                    <ThemeToggle />
                    <Button variant="outline" asChild>
                        <Link href={`/${locale}/login`}>{t('loginButton')}</Link>
                    </Button>
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

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
                    {plans.map((plan) => (
                        <Card key={plan.nameKey} className={cn(
                            "flex flex-col relative",
                            plan.popular ? "border-primary shadow-lg scale-105 z-10" : "border-border"
                        )}>
                            {plan.popular && (
                                <div className="absolute -top-4 left-0 right-0 flex justify-center">
                                    <Badge className="bg-primary text-primary-foreground px-3 py-1">{t('mostPopular')}</Badge>
                                </div>
                            )}
                            <CardHeader>
                                <div className="flex items-center gap-2 mb-2">
                                    <plan.icon className={cn("h-5 w-5", plan.popular ? "text-primary" : "text-muted-foreground")} />
                                    <CardTitle className="text-xl">{t(plan.nameKey)}</CardTitle>
                                </div>
                                <div className="flex items-end gap-2">
                                    <div className="flex flex-col">
                                        <span className="text-3xl font-bold">{plan.price}</span>
                                    </div>
                                    <span className="text-muted-foreground text-sm mb-1">{t(plan.durationKey)}</span>
                                </div>
                                <CardDescription>
                                    {plan.isLifetime ? t('billingOnce') : t('billingAuto')}
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
                                <Button className="w-full cursor-pointer" variant={plan.popular ? "default" : "outline"} asChild>
                                    <a href={plan.link}>
                                        {t('selectPlan')}
                                    </a>
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
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
                <p>
                    © {new Date().getFullYear()} Client Desk. {tl('footerMadeWith')} <a href="https://instagram.com/ryanekopram" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@ryanekopram</a> & <a href="https://instagram.com/ryanekoapps" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@ryanekoapps</a>
                </p>
            </footer>
        </div>
    )
}
