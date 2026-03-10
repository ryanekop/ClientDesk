"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useTranslations, useLocale } from "next-intl"
import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

const landingFaqKeys = ["q1", "q2", "q3", "q4", "q6", "q9"] as const

export function AnimatedFAQ() {
    const t = useTranslations("Landing")
    const faq = useTranslations("FAQ")
    const locale = useLocale()
    const [openIndex, setOpenIndex] = useState<number | null>(null)

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="text-center mb-12"
            >
                <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                    {t("faqSectionTitle")}
                </h2>
                <p className="text-muted-foreground text-lg">
                    {t("faqSectionSubtitle")}
                </p>
            </motion.div>

            <div className="max-w-3xl mx-auto space-y-3">
                {landingFaqKeys.map((key, index) => (
                    <motion.div
                        key={key}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.08 }}
                    >
                        <button
                            onClick={() =>
                                setOpenIndex(openIndex === index ? null : index)
                            }
                            className="w-full text-left rounded-xl border bg-card hover:bg-muted/50 transition-colors p-5 cursor-pointer group"
                        >
                            <div className="flex items-center justify-between gap-4">
                                <h3 className="font-semibold text-base sm:text-lg">
                                    {faq(key)}
                                </h3>
                                <ChevronDown
                                    className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300 ${openIndex === index ? "rotate-180" : ""
                                        }`}
                                />
                            </div>
                            <AnimatePresence initial={false}>
                                {openIndex === index && (
                                    <motion.div
                                        initial={{
                                            height: 0,
                                            opacity: 0,
                                        }}
                                        animate={{
                                            height: "auto",
                                            opacity: 1,
                                            transition: {
                                                height: {
                                                    type: "spring",
                                                    stiffness: 500,
                                                    damping: 40,
                                                    mass: 0.8,
                                                },
                                                opacity: {
                                                    duration: 0.25,
                                                    delay: 0.05,
                                                },
                                            },
                                        }}
                                        exit={{
                                            height: 0,
                                            opacity: 0,
                                            transition: {
                                                height: {
                                                    type: "spring",
                                                    stiffness: 500,
                                                    damping: 40,
                                                    mass: 0.8,
                                                },
                                                opacity: {
                                                    duration: 0.15,
                                                },
                                            },
                                        }}
                                        className="overflow-hidden"
                                    >
                                        <p className="text-muted-foreground mt-3 pt-3 border-t text-sm sm:text-base leading-relaxed">
                                            {faq(
                                                key.replace(
                                                    "q",
                                                    "a"
                                                ) as `a${string}`
                                            )}
                                        </p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </button>
                    </motion.div>
                ))}
            </div>

            <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="text-center mt-10"
            >
                <Button
                    variant="outline"
                    size="lg"
                    asChild
                    className="gap-2"
                >
                    <Link href={`/${locale}/faq`}>
                        ❓ {t("faqSeeAll")}{" "}
                        <ArrowRight className="h-5 w-5" />
                    </Link>
                </Button>
            </motion.div>
        </>
    )
}
