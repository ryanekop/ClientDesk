"use client";

import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  CreditCard,
  FolderKanban,
  HelpCircle,
  LayoutDashboard,
  ListOrdered,
  Network,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { OpenSetupGuideButton } from "@/components/tutorial/open-setup-guide-button";
import { TUTORIAL_TOPICS, type TutorialTopicIconKey } from "@/lib/tutorial";

const TOPIC_ICON_MAP = {
  overview: LayoutDashboard,
  workflow: Workflow,
  formVsManual: FolderKanban,
  servicesPackages: BriefcaseBusiness,
  teamAssignment: Users,
  bookingList: ListOrdered,
  bookingStatus: Sparkles,
  finance: CreditCard,
  googleIntegration: CalendarDays,
  dailyTips: HelpCircle,
} satisfies Record<TutorialTopicIconKey, React.ComponentType<{ className?: string }>>;

export default function TutorialPage() {
  const t = useTranslations("Tutorial");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
        <div className="grid gap-6 px-6 py-8 lg:grid-cols-[1.25fr_0.9fr] lg:px-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5" />
              {t("badge")}
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {t("title")}
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                {t("description")}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <OpenSetupGuideButton label={t("openSetup")} />
              <Button variant="outline" asChild>
                <Link href="/faq">{t("openFaq")}</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl border bg-muted/20 p-4">
            <div className="rounded-2xl border bg-background px-4 py-4">
              <p className="text-sm font-semibold">{t("surfaces.setupTitle")}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t("surfaces.setupDescription")}
              </p>
            </div>
            <div className="rounded-2xl border bg-background px-4 py-4">
              <p className="text-sm font-semibold">{t("surfaces.tutorialTitle")}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t("surfaces.tutorialDescription")}
              </p>
            </div>
            <div className="rounded-2xl border border-dashed bg-background px-4 py-4">
              <div className="flex items-start gap-3">
                <Network className="mt-0.5 h-4.5 w-4.5 text-muted-foreground" />
                <p className="text-sm leading-6 text-muted-foreground">
                  {t("antiDuplication")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">
            {t("topicsTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("topicsDescription")}</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {TUTORIAL_TOPICS.map((topic, index) => {
            const Icon = TOPIC_ICON_MAP[topic.icon];

            return (
              <Link
                key={topic.id}
                href={`/tutorial/${topic.slug}`}
                className="group block rounded-2xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-muted/10 hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-colors ${topic.accent.iconBg} ${topic.accent.iconBorder}`}
                  >
                    <Icon className={`h-5 w-5 ${topic.accent.icon}`} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <h3 className="text-base font-semibold">
                        {t(`topics.${topic.id}.title`)}
                      </h3>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {t(`topics.${topic.id}.description`)}
                    </p>
                    <div className="inline-flex items-center gap-2 pt-1 text-sm font-medium text-foreground">
                      {t("readTutorial")}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
