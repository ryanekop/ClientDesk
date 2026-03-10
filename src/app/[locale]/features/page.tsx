"use client"

import { useTranslations, useLocale } from 'next-intl'
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageSwitcher } from "@/components/language-switcher"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from 'next/link'
import { motion } from "framer-motion"
import {
    CalendarCheck, Zap, FileText, MessageSquare, FolderOpen, Globe,
    Users, ClipboardCheck, Upload, Layers, Moon, Globe2,
    ArrowLeft, ArrowRight, Sparkles
} from "lucide-react"

const coreFeatures = [
    { icon: CalendarCheck, titleKey: 'feature1Title', descKey: 'feature1Desc', color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { icon: FileText, titleKey: 'feature2Title', descKey: 'feature2Desc', color: 'text-green-500', bg: 'bg-green-500/10' },
    { icon: MessageSquare, titleKey: 'feature3Title', descKey: 'feature3Desc', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { icon: Zap, titleKey: 'feature4Title', descKey: 'feature4Desc', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    { icon: FolderOpen, titleKey: 'feature5Title', descKey: 'feature5Desc', color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
    { icon: Globe, titleKey: 'feature6Title', descKey: 'feature6Desc', color: 'text-purple-500', bg: 'bg-purple-500/10' },
]

const additionalFeatures = [
    { icon: Users, titleKey: 'feature7Title', descKey: 'feature7Desc', color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { icon: ClipboardCheck, titleKey: 'feature8Title', descKey: 'feature8Desc', color: 'text-rose-500', bg: 'bg-rose-500/10' },
    { icon: Upload, titleKey: 'feature9Title', descKey: 'feature9Desc', color: 'text-sky-500', bg: 'bg-sky-500/10' },
    { icon: Layers, titleKey: 'feature10Title', descKey: 'feature10Desc', color: 'text-pink-500', bg: 'bg-pink-500/10' },
    { icon: Moon, titleKey: 'feature11Title', descKey: 'feature11Desc', color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
    { icon: Globe2, titleKey: 'feature12Title', descKey: 'feature12Desc', color: 'text-teal-500', bg: 'bg-teal-500/10' },
]

export default function FeaturesPage() {
    const t = useTranslations('Features')
    const tl = useTranslations('Landing')
    const locale = useLocale()

    const FeatureCard = ({ feature, index, large = false }: { feature: typeof coreFeatures[0], index: number, large?: boolean }) => {
        const Icon = feature.icon
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                className="h-full"
            >
                <Card className={`h-full hover:shadow-xl transition-all duration-300 group border-0 shadow-md ${large ? 'hover:-translate-y-1' : ''}`}>
                    <CardContent className={large ? "pt-8 pb-8" : "pt-6"}>
                        <div className={`${large ? 'h-16 w-16 mb-6' : 'h-12 w-12 mb-4'} rounded-2xl ${feature.bg} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                            <Icon className={`${large ? 'h-8 w-8' : 'h-6 w-6'} ${feature.color}`} />
                        </div>
                        <h3 className={`font-bold ${large ? 'text-xl mb-3' : 'text-lg mb-2'}`}>{t(feature.titleKey)}</h3>
                        <p className="text-muted-foreground leading-relaxed">{t(feature.descKey)}</p>
                    </CardContent>
                </Card>
            </motion.div>
        )
    }

    const chunkIntoRows = <T,>(arr: T[], cols: number): T[][] => {
        const rows: T[][] = []
        for (let i = 0; i < arr.length; i += cols) rows.push(arr.slice(i, i + cols))
        return rows
    }

    const FeatureGrid = ({ items, large = false, cols = 3 }: { items: typeof coreFeatures, large?: boolean, cols?: number }) => {
        const rows = chunkIntoRows(items, cols)
        return (
            <div className="max-w-6xl mx-auto space-y-6">
                {rows.map((row, rowIdx) => (
                    <div key={rowIdx} className="flex flex-col sm:flex-row gap-6">
                        {row.map((feature, colIdx) => (
                            <div key={feature.titleKey} className="w-full sm:flex-1">
                                <FeatureCard feature={feature} index={rowIdx * cols + colIdx} large={large} />
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        )
    }

    return (
        <div className="flex flex-col min-h-screen font-[family-name:var(--font-geist-sans)]">
            <header className="sticky top-0 z-50 flex items-center justify-between p-4 border-b bg-background/80 backdrop-blur-sm">
                <Link href={`/${locale}`} className="font-bold text-xl tracking-tight flex items-center gap-3 hover:opacity-80 transition-opacity">
                    Client Desk
                </Link>
                <div className="flex items-center gap-2">
                    <LanguageSwitcher />
                    <ThemeToggle />
                </div>
            </header>

            {/* Hero */}
            <section className="relative overflow-hidden bg-gradient-to-b from-background via-muted/30 to-background py-16 sm:py-24">
                <div className="container mx-auto px-4">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center space-y-4 max-w-3xl mx-auto"
                    >
                        <Button variant="ghost" size="sm" asChild className="gap-1 mb-4">
                            <Link href={`/${locale}`}>
                                <ArrowLeft className="h-4 w-4" /> Home
                            </Link>
                        </Button>
                        <Badge variant="secondary">
                            <Sparkles className="h-3 w-3 mr-1" />
                            12 {t('pageTitle').includes('Fitur') ? 'Fitur' : 'Features'}
                        </Badge>
                        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
                            {t('pageTitle')}
                        </h1>
                        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                            {t('pageDescription')}
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Core Features */}
            <section className="py-16">
                <div className="container mx-auto px-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        className="text-center mb-10"
                    >
                        <h2 className="text-3xl font-bold mb-2">⭐ {t('coreFeatures')}</h2>
                    </motion.div>
                    <FeatureGrid items={coreFeatures} large cols={3} />
                </div>
            </section>

            {/* Additional Features */}
            <section className="py-16 bg-muted/20">
                <div className="container mx-auto px-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        className="text-center mb-10"
                    >
                        <h2 className="text-3xl font-bold mb-2">✨ {t('additionalFeatures')}</h2>
                    </motion.div>
                    <FeatureGrid items={additionalFeatures} cols={3} />
                </div>
            </section>

            {/* CTA */}
            <section className="py-16">
                <div className="container mx-auto px-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        className="text-center max-w-2xl mx-auto bg-primary rounded-3xl p-8 sm:p-12 text-primary-foreground"
                    >
                        <h2 className="text-3xl font-bold mb-4">{tl('ctaTitle')}</h2>
                        <p className="text-primary-foreground/80 text-lg mb-8">{tl('ctaSubtitle')}</p>
                        <Button size="lg" variant="secondary" asChild className="gap-2 text-lg px-8">
                            <Link href={`/${locale}/register`}>
                                🎉 {t('startNow')} <ArrowRight className="h-5 w-5" />
                            </Link>
                        </Button>
                    </motion.div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-8 border-t text-center text-sm text-muted-foreground">
                <p>
                    © {new Date().getFullYear()} Client Desk. {tl('footerMadeWith')} <a href="https://instagram.com/ryanekopram" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@ryanekopram</a> & <a href="https://instagram.com/ryanekoapps" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@ryanekoapps</a>
                </p>
            </footer>
        </div>
    )
}
