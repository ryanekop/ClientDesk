"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useTranslations, useLocale } from "next-intl"
import { ChevronDown, ArrowLeft, HelpCircle, Puzzle, CreditCard, Wrench, Sparkles } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageSwitcher } from "@/components/language-switcher"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

const categories = [
    { key: "categoryGeneral", icon: HelpCircle, color: "text-blue-500", bg: "bg-blue-500/10", questions: ["q1", "q2", "q3", "q4", "q5"] },
    { key: "categoryFeatures", icon: Puzzle, color: "text-purple-500", bg: "bg-purple-500/10", questions: ["q9", "q10", "q11"] },
    { key: "categoryPricing", icon: CreditCard, color: "text-green-500", bg: "bg-green-500/10", questions: ["q6", "q7", "q8"] },
    { key: "categoryTechnical", icon: Wrench, color: "text-orange-500", bg: "bg-orange-500/10", questions: ["q12"] },
] as const

import { LandingNav } from "@/components/landing/landing-client"

export default function FAQPage() {
    const t = useTranslations("FAQ")
    const tl = useTranslations("Landing")
    const locale = useLocale()
    const [openItems, setOpenItems] = useState<Record<string, boolean>>({})

    const toggleItem = (key: string) => {
        setOpenItems((prev) => ({ ...prev, [key]: !prev[key] }))
    }

    return (
        <div className="flex flex-col min-h-screen font-[family-name:var(--font-geist-sans)]">
            <header className="sticky top-0 z-50 flex items-center justify-between p-4 border-b bg-background/80 backdrop-blur-sm">
                <Link href={`/${locale}`} className="font-bold text-xl tracking-tight flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <img src="/icon-192.png" alt="Client Desk" className="h-8 w-8 rounded-lg" />
                    Client Desk
                </Link>
                <div className="flex items-center gap-2">
                    <LanguageSwitcher />
                    <ThemeToggle />
                    <LandingNav />
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
                            FAQ
                        </Badge>
                        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
                            {t("pageTitle")}
                        </h1>
                        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                            {t("pageDescription")}
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Content */}
            <main className="flex-1 py-12 sm:py-16">
                <div className="container mx-auto px-4">
                    <div className="max-w-3xl mx-auto space-y-12">
                        {categories.map((category, catIndex) => {
                            const IconComp = category.icon
                            return (
                                <motion.div
                                    key={category.key}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: catIndex * 0.15 }}
                                >
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className={`h-10 w-10 rounded-lg ${category.bg} flex items-center justify-center`}>
                                            <IconComp className={`h-5 w-5 ${category.color}`} />
                                        </div>
                                        <h2 className="text-xl font-bold">{t(category.key)}</h2>
                                    </div>

                                    <div className="space-y-3">
                                        {category.questions.map((qKey, qIndex) => (
                                            <motion.div
                                                key={qKey}
                                                initial={{ opacity: 0, y: 10 }}
                                                whileInView={{ opacity: 1, y: 0 }}
                                                viewport={{ once: true }}
                                                transition={{ delay: catIndex * 0.15 + qIndex * 0.05 }}
                                            >
                                                <button
                                                    onClick={() => toggleItem(qKey)}
                                                    className="w-full text-left rounded-xl border bg-card hover:bg-muted/50 transition-colors p-5 cursor-pointer"
                                                >
                                                    <div className="flex items-center justify-between gap-4">
                                                        <h3 className="font-semibold text-base sm:text-lg">
                                                            {t(qKey as any)}
                                                        </h3>
                                                        <ChevronDown
                                                            className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300 ${openItems[qKey] ? "rotate-180" : ""}`}
                                                        />
                                                    </div>
                                                    <AnimatePresence initial={false}>
                                                        {openItems[qKey] && (
                                                            <motion.div
                                                                initial={{ height: 0, opacity: 0 }}
                                                                animate={{
                                                                    height: "auto",
                                                                    opacity: 1,
                                                                    transition: {
                                                                        height: { type: "spring", stiffness: 500, damping: 40, mass: 0.8 },
                                                                        opacity: { duration: 0.25, delay: 0.05 },
                                                                    },
                                                                }}
                                                                exit={{
                                                                    height: 0,
                                                                    opacity: 0,
                                                                    transition: {
                                                                        height: { type: "spring", stiffness: 500, damping: 40, mass: 0.8 },
                                                                        opacity: { duration: 0.15 },
                                                                    },
                                                                }}
                                                                className="overflow-hidden"
                                                            >
                                                                <p className="text-muted-foreground mt-3 pt-3 border-t text-sm sm:text-base leading-relaxed">
                                                                    {t(qKey.replace("q", "a") as any)}
                                                                </p>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </button>
                                            </motion.div>
                                        ))}
                                    </div>
                                </motion.div>
                            )
                        })}
                    </div>

                    {/* Still have questions? */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.3 }}
                        className="text-center mt-20 max-w-lg mx-auto bg-muted/30 rounded-2xl p-8"
                    >
                        <h3 className="text-xl font-bold mb-2">
                            {t("stillHaveQuestions")}
                        </h3>
                        <a
                            href="https://instagram.com/ryanekoapps"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
                        >
                            📩 {t("contactUs")}
                        </a>
                    </motion.div>
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
