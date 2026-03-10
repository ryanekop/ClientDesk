"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslations } from "next-intl";
import {
  FolderOpen,
  PenLine,
  Clock,
  Search,
  BellOff,
  DollarSign,
} from "lucide-react";

type ProblemKey = "1" | "2" | "3" | "4" | "5" | "6";

const problems: {
  key: ProblemKey;
  icon: React.ElementType;
  color: string;
  bg: string;
}[] = [
  { key: "1", icon: FolderOpen, color: "text-red-500", bg: "bg-red-500/10" },
  { key: "2", icon: PenLine, color: "text-orange-500", bg: "bg-orange-500/10" },
  { key: "3", icon: Clock, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  { key: "4", icon: Search, color: "text-blue-500", bg: "bg-blue-500/10" },
  { key: "5", icon: BellOff, color: "text-purple-500", bg: "bg-purple-500/10" },
  {
    key: "6",
    icon: DollarSign,
    color: "text-green-500",
    bg: "bg-green-500/10",
  },
];

export function ProblemSection() {
  const t = useTranslations("Landing");

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-12"
      >
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">
          {t("problemTitle")}
        </h2>
        <p className="text-muted-foreground text-lg">{t("problemSubtitle")}</p>
      </motion.div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {problems.map((problem, index) => {
          const Icon = problem.icon;
          return (
            <motion.div
              key={problem.key}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="h-full hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div
                    className={`h-12 w-12 rounded-lg ${problem.bg} flex items-center justify-center mb-4`}
                  >
                    <Icon className={`h-6 w-6 ${problem.color}`} />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">
                    {t(
                      `problem${problem.key}Title` as `problem${ProblemKey}Title`,
                    )}
                  </h3>
                  <p className="text-muted-foreground">
                    {t(
                      `problem${problem.key}Desc` as `problem${ProblemKey}Desc`,
                    )}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </>
  );
}
