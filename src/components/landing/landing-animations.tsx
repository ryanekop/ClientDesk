"use client"

import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { useTranslations } from 'next-intl'
import {
    CalendarCheck, Zap, FileText, MessageSquare, FolderPlus, Globe,
    FolderOpen, Share2, CheckCircle2
} from "lucide-react"

const features = [
    { icon: CalendarCheck, titleKey: 'feature1Title', descKey: 'feature1Desc', color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { icon: FileText, titleKey: 'feature2Title', descKey: 'feature2Desc', color: 'text-green-500', bg: 'bg-green-500/10' },
    { icon: MessageSquare, titleKey: 'feature3Title', descKey: 'feature3Desc', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { icon: Zap, titleKey: 'feature4Title', descKey: 'feature4Desc', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    { icon: FolderOpen, titleKey: 'feature5Title', descKey: 'feature5Desc', color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
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
            className="text-center space-y-6 max-w-4xl mx-auto"
        >
            {children}
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
