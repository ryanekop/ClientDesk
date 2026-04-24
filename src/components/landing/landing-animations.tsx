"use client"

import { motion, useReducedMotion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { useTranslations } from 'next-intl'
import {
    CalendarDays, ClipboardCheck, FileText, Globe, LayoutDashboard,
    MessageSquare, FolderPlus, Share2, CheckCircle2, Check, Send
} from "lucide-react"

const features = [
    { icon: LayoutDashboard, titleKey: 'feature1Title', descKey: 'feature1Desc', color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { icon: FileText, titleKey: 'feature2Title', descKey: 'feature2Desc', color: 'text-green-500', bg: 'bg-green-500/10' },
    { icon: MessageSquare, titleKey: 'feature3Title', descKey: 'feature3Desc', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { icon: ClipboardCheck, titleKey: 'feature4Title', descKey: 'feature4Desc', color: 'text-rose-500', bg: 'bg-rose-500/10' },
    { icon: CalendarDays, titleKey: 'feature5Title', descKey: 'feature5Desc', color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
    { icon: Globe, titleKey: 'feature6Title', descKey: 'feature6Desc', color: 'text-purple-500', bg: 'bg-purple-500/10' },
]

const steps = [
    { icon: FolderPlus, titleKey: 'step1Title', descKey: 'step1Desc', step: '1' },
    { icon: Share2, titleKey: 'step2Title', descKey: 'step2Desc', step: '2' },
    { icon: CheckCircle2, titleKey: 'step3Title', descKey: 'step3Desc', step: '3' },
]

export function AnimatedHero({ children }: { children: React.ReactNode }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-4xl space-y-6 text-center lg:mx-0 lg:max-w-2xl lg:text-left"
        >
            {children}
        </motion.div>
    )
}

const bookingFields = [
    { label: "Nama Klien", value: "Nadia Putri" },
    { label: "Paket", value: "Graduation Premium" },
    { label: "Tanggal", value: "24 Apr 2026, 09.00" },
]

const calendarDays = [
    ["20", "21", "22", "23", "24", "25", "26"],
    ["27", "28", "29", "30", "1", "2", "3"],
]

export function LandingHeroDemo() {
    const shouldReduceMotion = useReducedMotion()
    const loopTransition = shouldReduceMotion
        ? { duration: 0 }
        : { duration: 12, repeat: Infinity, ease: "easeInOut" as const }
    const finalOpacity = shouldReduceMotion ? 1 : undefined
    const finalY = shouldReduceMotion ? 0 : undefined

    return (
        <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="relative hidden w-full max-w-[43rem] justify-self-end lg:block"
            aria-hidden="true"
        >
            <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-primary/10 via-background to-muted/70 blur-2xl" />
            <div className="relative overflow-hidden rounded-3xl border bg-card/95 shadow-2xl">
                <div className="flex items-center justify-between border-b bg-muted/35 px-5 py-3">
                    <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            Live booking flow
                        </p>
                        <p className="text-sm font-semibold">ClientDesk Demo</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                        <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    </div>
                </div>

                <div className="grid gap-4 p-5">
                    <div className="rounded-2xl border bg-background p-4 shadow-sm">
                        <div className="mb-3 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-semibold">Form Booking</p>
                                <p className="text-xs text-muted-foreground">Diisi otomatis oleh klien</p>
                            </div>
                            <motion.span
                                animate={
                                    shouldReduceMotion
                                        ? { opacity: 1 }
                                        : { opacity: [0.5, 1, 0.5] }
                                }
                                transition={loopTransition}
                                className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                            >
                                Online
                            </motion.span>
                        </div>

                        <div className="space-y-3">
                            {bookingFields.map((field, index) => (
                                <div key={field.label} className="space-y-1.5">
                                    <span className="text-xs font-medium text-muted-foreground">
                                        {field.label}
                                    </span>
                                    <div className="h-9 overflow-hidden rounded-lg border bg-muted/20 px-3">
                                        <motion.div
                                            animate={{
                                                width: shouldReduceMotion
                                                    ? "100%"
                                                    : ["0%", "0%", "100%", "100%", "100%", "100%"],
                                            }}
                                            transition={{
                                                ...loopTransition,
                                                delay: shouldReduceMotion ? 0 : index * 0.45,
                                                times: [0, 0.08, 0.22, 0.58, 0.9, 1],
                                            }}
                                            className="flex h-full max-w-full items-center overflow-hidden whitespace-nowrap"
                                        >
                                            <span className="text-sm font-medium">{field.value}</span>
                                            {!shouldReduceMotion ? (
                                                <motion.span
                                                    animate={{ opacity: [0, 1, 0] }}
                                                    transition={{ duration: 0.8, repeat: Infinity }}
                                                    className="ml-0.5 h-4 w-px bg-foreground"
                                                />
                                            ) : null}
                                        </motion.div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="relative mt-4 flex h-9 items-center justify-center gap-2 overflow-hidden rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
                            <motion.span
                                animate={shouldReduceMotion ? { opacity: 0 } : { opacity: [1, 1, 0, 0, 0, 1] }}
                                transition={{ ...loopTransition, times: [0, 0.45, 0.52, 0.82, 0.9, 1] }}
                                className="absolute flex items-center gap-2"
                            >
                                <Send className="h-4 w-4" /> Kirim booking
                            </motion.span>
                            <motion.span
                                animate={{ opacity: shouldReduceMotion ? 1 : [0, 0, 1, 1, 1, 0] }}
                                transition={{ ...loopTransition, times: [0, 0.45, 0.54, 0.82, 0.9, 1] }}
                                className="absolute flex items-center gap-2"
                            >
                                <Check className="h-4 w-4" /> Booking masuk
                            </motion.span>
                        </div>
                    </div>

                    <div className="grid grid-cols-[1.05fr_0.95fr] gap-4">
                        <div className="rounded-2xl border bg-background p-4 shadow-sm">
                            <div className="mb-3 flex items-center justify-between">
                                <p className="text-sm font-semibold">Data Booking</p>
                                <span className="text-xs text-muted-foreground">Hari ini</span>
                            </div>
                            <div className="space-y-2">
                                <div className="rounded-xl border bg-muted/25 p-3">
                                    <p className="text-sm font-medium">Raka & Tim</p>
                                    <p className="text-xs text-muted-foreground">Family Portrait - 13.00</p>
                                </div>
                                <motion.div
                                    animate={{
                                        opacity: finalOpacity ?? [0, 0, 0, 1, 1, 0],
                                        y: finalY ?? [12, 12, 12, 0, 0, -6],
                                    }}
                                    transition={{ ...loopTransition, times: [0, 0.5, 0.58, 0.68, 0.9, 1] }}
                                    className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3"
                                >
                                    <p className="text-sm font-semibold">Nadia Putri</p>
                                    <p className="text-xs text-muted-foreground">
                                        Graduation Premium - 09.00
                                    </p>
                                </motion.div>
                            </div>
                        </div>

                        <div className="rounded-2xl border bg-background p-4 shadow-sm">
                            <div className="mb-3 flex items-center justify-between">
                                <p className="text-sm font-semibold">Kalender</p>
                                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-muted-foreground">
                                {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                                    <span key={`${day}-${index}`}>{day}</span>
                                ))}
                            </div>
                            <div className="mt-2 space-y-1">
                                {calendarDays.map((week, weekIndex) => (
                                    <div key={weekIndex} className="grid grid-cols-7 gap-1">
                                        {week.map((day) => {
                                            const isTarget = day === "24"
                                            return (
                                                <span
                                                    key={day}
                                                    className="relative flex aspect-square items-center justify-center text-xs font-semibold"
                                                >
                                                    {isTarget ? (
                                                        <motion.span
                                                            animate={{
                                                                opacity: finalOpacity ?? [0, 0, 0, 1, 1, 0],
                                                                scale: shouldReduceMotion
                                                                    ? 1
                                                                    : [0.7, 0.7, 0.7, 1, 1, 0.85],
                                                            }}
                                                            transition={{
                                                                ...loopTransition,
                                                                times: [0, 0.58, 0.68, 0.76, 0.9, 1],
                                                            }}
                                                            className="absolute inset-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 shadow-[0_0_0_3px_rgba(16,185,129,0.08)]"
                                                        />
                                                    ) : null}
                                                    <span className="relative z-10 text-foreground">{day}</span>
                                                </span>
                                            )
                                        })}
                                    </div>
                                ))}
                            </div>
                            <motion.div
                                animate={{
                                    opacity: finalOpacity ?? [0, 0, 0, 1, 1, 0],
                                    y: finalY ?? [8, 8, 8, 0, 0, -4],
                                }}
                                transition={{ ...loopTransition, times: [0, 0.62, 0.72, 0.8, 0.9, 1] }}
                                className="mt-3 rounded-lg border bg-muted/25 px-3 py-2"
                            >
                                <p className="text-[11px] font-semibold">09.00 Graduation</p>
                                <p className="text-[10px] text-muted-foreground">Slot otomatis terisi</p>
                            </motion.div>
                        </div>
                    </div>

                </div>
            </div>
        </motion.div>
    )
}

export function AnimatedFeatures() {
    const t = useTranslations('Landing')
    const COLS = 3

    const rows: typeof features[] = []
    for (let i = 0; i < features.length; i += COLS) rows.push(features.slice(i, i + COLS))

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="text-center mb-12"
            >
                <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t('featuresTitle')}</h2>
                <p className="text-muted-foreground text-lg">{t('featuresSubtitle')}</p>
            </motion.div>

            <div className="max-w-6xl mx-auto space-y-6">
                {rows.map((row, rowIdx) => (
                    <div
                        key={rowIdx}
                        className="flex flex-col sm:flex-row gap-6"
                    >
                        {row.map((feature, colIdx) => {
                            const Icon = feature.icon
                            return (
                                <div
                                    key={feature.titleKey}
                                    className="w-full sm:flex-1"
                                >
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: (rowIdx * COLS + colIdx) * 0.1 }}
                                        className="h-full"
                                    >
                                        <Card className="h-full hover:shadow-lg transition-shadow">
                                            <CardContent className="pt-6">
                                                <div className={`h-12 w-12 rounded-lg ${feature.bg} flex items-center justify-center mb-4`}>
                                                    <Icon className={`h-6 w-6 ${feature.color}`} />
                                                </div>
                                                <h3 className="font-semibold text-lg mb-2">{t(feature.titleKey)}</h3>
                                                <p className="text-muted-foreground">{t(feature.descKey)}</p>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                </div>
                            )
                        })}
                    </div>
                ))}
            </div>
        </>
    )
}

export function AnimatedWorkflow() {
    const t = useTranslations('Landing')

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="text-center mb-12"
            >
                <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t('workflowTitle')}</h2>
                <p className="text-muted-foreground text-lg">{t('workflowSubtitle')}</p>
            </motion.div>

            <div className="flex flex-col md:flex-row gap-8 justify-center items-center max-w-4xl mx-auto">
                {steps.map((step, index) => {
                    const Icon = step.icon
                    return (
                        <motion.div
                            key={step.step}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.2 }}
                            className="flex flex-col items-center text-center flex-1"
                        >
                            <div className="relative">
                                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                    <Icon className="h-10 w-10 text-primary" />
                                </div>
                                <span className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                                    {step.step}
                                </span>
                            </div>
                            <h3 className="font-semibold text-lg mb-2">{t(step.titleKey)}</h3>
                            <p className="text-muted-foreground text-sm">{t(step.descKey)}</p>
                        </motion.div>
                    )
                })}
            </div>
        </>
    )
}

export function AnimatedSection({ children, className }: { children: React.ReactNode, className?: string }) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className={className}
        >
            {children}
        </motion.div>
    )
}

export function AnimatedCTA({ children }: { children: React.ReactNode }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="text-center max-w-2xl mx-auto bg-primary rounded-3xl p-8 sm:p-12 text-primary-foreground"
        >
            {children}
        </motion.div>
    )
}
