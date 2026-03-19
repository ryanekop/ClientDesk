import { getTranslations } from 'next-intl/server'
import { getLocale } from 'next-intl/server'
import { getTenantConfig } from "@/lib/tenant-config"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageSwitcher } from "@/components/language-switcher"
import { Button } from "@/components/ui/button"
import Link from 'next/link'
import { ArrowLeft } from "lucide-react"
import { LandingNav } from "@/components/landing/landing-client"
import { TenantLogo } from "@/components/layout/tenant-logo"

export default async function PrivacyPage() {
    const t = await getTranslations('Privacy')
    const tl = await getTranslations('Landing')
    const locale = await getLocale()
    const tenant = await getTenantConfig()

    const sections = [
        { title: t('section1Title'), content: t('section1Content') },
        { title: t('section2Title'), content: t('section2Content') },
        { title: t('section3Title'), content: t('section3Content') },
        { title: t('section4Title'), content: t('section4Content') },
        { title: t('section5Title'), content: t('section5Content') },
        { title: t('section6Title'), content: t('section6Content') },
        { title: t('section7Title'), content: t('section7Content') },
        { title: t('section8Title'), content: t('section8Content') },
        { title: t('section9Title'), content: t('section9Content') },
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

            <main className="flex-1 container mx-auto px-4 py-16 max-w-3xl">
                <div className="mb-8">
                    <Button variant="ghost" size="sm" asChild className="gap-1 mb-6">
                        <Link href={`/${locale}`}>
                            <ArrowLeft className="h-4 w-4" /> Home
                        </Link>
                    </Button>

                    <h1 className="text-4xl font-extrabold tracking-tight mb-2">
                        {t('pageTitle')}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {t('lastUpdated')}
                    </p>
                </div>

                <div className="space-y-8">
                    {sections.map((section, index) => (
                        <div key={index}>
                            <h2 className="text-xl font-bold mb-3">{section.title}</h2>
                            <p className="text-muted-foreground leading-relaxed">{section.content}</p>
                        </div>
                    ))}
                </div>
            </main>

            <footer className="py-8 border-t text-center text-sm text-muted-foreground">
                <p>
                    © {new Date().getFullYear()} {tenant.name}. {tl('footerMadeWith')} <a href="https://instagram.com/ryanekopram" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@ryanekopram</a> & <a href="https://instagram.com/ryanekoapps" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@ryanekoapps</a>
                </p>
            </footer>
        </div>
    )
}
