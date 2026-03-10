import { getTranslations } from 'next-intl/server'
import { getLocale } from 'next-intl/server'
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageSwitcher } from "@/components/language-switcher"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from 'next/link'
import { Sparkles, ArrowRight } from "lucide-react"

import { LandingNav, HeroCTA, BottomCTA, DesktopNav, MobileNav } from "@/components/landing/landing-client"
import { AnimatedHero, AnimatedFeatures, AnimatedWorkflow, AnimatedSection, AnimatedCTA } from "@/components/landing/landing-animations"
import { AnimatedFAQ } from "@/components/landing/faq-section"
import { ProblemSection } from "@/components/landing/problem-section"

export default async function Home() {
  const t = await getTranslations('Landing')
  const locale = await getLocale()

  return (
    <div className="flex flex-col min-h-screen font-[family-name:var(--font-geist-sans)]">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between p-4 border-b bg-background/80 backdrop-blur-sm">
        <Link href={`/${locale}`} className="font-bold text-xl tracking-tight flex items-center gap-3 hover:opacity-80 transition-opacity">
          Client Desk
        </Link>
        <DesktopNav />
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          <LandingNav />
          <MobileNav />
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-background via-muted/30 to-background py-20 sm:py-32">
        <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none"></div>
        <div className="container mx-auto px-4">
          <AnimatedHero>
            <Badge variant="secondary" className="mb-4">
              <Sparkles className="h-3 w-3 mr-1" />
              {t('heroTagline')}
            </Badge>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight">
              {t('title')}
              <span className="block text-primary mt-2">{t('subtitle')}</span>
            </h1>

            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t('description')}
            </p>

            <HeroCTA />

            <p className="text-sm text-muted-foreground pt-4">
              ✨ {t('trustedBy')}
            </p>
          </AnimatedHero>
        </div>
      </section>

      {/* Problem Section */}
      <section id="problems" className="py-20 bg-muted/20">
        <div className="container mx-auto px-4">
          <ProblemSection />
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 scroll-mt-20">
        <div className="container mx-auto px-4">
          <AnimatedFeatures />

          <AnimatedSection className="text-center mt-10">
            <Button variant="outline" size="lg" asChild className="gap-2">
              <Link href={`/${locale}/features`}>
                ✨ {t('seeAllFeatures')} <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          </AnimatedSection>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="workflow" className="py-20 bg-muted/20 scroll-mt-20">
        <div className="container mx-auto px-4">
          <AnimatedWorkflow />
        </div>
      </section>

      {/* Pricing Preview Section */}
      <section id="pricing" className="py-20 bg-gradient-to-b from-background to-muted/30 scroll-mt-20">
        <div className="container mx-auto px-4">
          <AnimatedSection className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t('pricingTitle')}</h2>
            <p className="text-muted-foreground text-lg mb-8">{t('pricingSubtitle')}</p>

            <Button size="lg" variant="outline" asChild className="gap-2">
              <Link href={`/${locale}/pricing`}>
                👀 {t('pricingCta')} <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          </AnimatedSection>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 bg-muted/20 scroll-mt-20">
        <div className="container mx-auto px-4">
          <AnimatedFAQ />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <AnimatedCTA>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t('ctaTitle')}</h2>
            <p className="text-primary-foreground/80 text-lg mb-8">{t('ctaSubtitle')}</p>
            <BottomCTA />
          </AnimatedCTA>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t bg-muted/10">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <h3 className="font-bold text-lg mb-3">Client Desk</h3>
              <p className="text-sm text-muted-foreground">
                {t('description').substring(0, 80)}...
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="font-semibold text-sm mb-3 text-muted-foreground uppercase tracking-wider">{t('footerProduct')}</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href={`/${locale}/features`} className="text-foreground/70 hover:text-foreground transition-colors">{t('footerFeatures')}</Link></li>
                <li><Link href={`/${locale}/pricing`} className="text-foreground/70 hover:text-foreground transition-colors">{t('footerPricing')}</Link></li>
                <li><Link href={`/${locale}/faq`} className="text-foreground/70 hover:text-foreground transition-colors">{t('footerFaq')}</Link></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-semibold text-sm mb-3 text-muted-foreground uppercase tracking-wider">{t('footerLegal')}</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href={`/${locale}/terms`} className="text-foreground/70 hover:text-foreground transition-colors">{t('footerTerms')}</Link></li>
                <li><Link href={`/${locale}/privacy`} className="text-foreground/70 hover:text-foreground transition-colors">{t('footerPrivacy')}</Link></li>
              </ul>
            </div>

            {/* Social */}
            <div>
              <h4 className="font-semibold text-sm mb-3 text-muted-foreground uppercase tracking-wider">{t('footerSocial')}</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="https://instagram.com/ryanekoapps" target="_blank" rel="noopener noreferrer" className="text-foreground/70 hover:text-foreground transition-colors">Instagram</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t pt-6 text-center text-sm text-muted-foreground">
            <p>
              © {new Date().getFullYear()} Client Desk. {t('footerMadeWith')} <a href="https://instagram.com/ryanekopram" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@ryanekopram</a> & <a href="https://instagram.com/ryanekoapps" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@ryanekoapps</a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
