import {
  ArrowUpRight,
  Brush,
  Compass,
  PanelsTopLeft,
  RefreshCcw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const FEATURE_META = [
  {
    key: "kanban",
    icon: PanelsTopLeft,
    hasVideo: true,
    accent: {
      iconBg: "bg-sky-100 dark:bg-sky-500/10",
      iconBorder: "border-sky-200 dark:border-sky-500/20",
      icon: "text-sky-700 dark:text-sky-300",
    },
  },
  {
    key: "midtrans",
    icon: Wallet,
    hasVideo: false,
    accent: {
      iconBg: "bg-emerald-100 dark:bg-emerald-500/10",
      iconBorder: "border-emerald-200 dark:border-emerald-500/20",
      icon: "text-emerald-700 dark:text-emerald-300",
    },
  },
  {
    key: "spreadsheet",
    icon: RefreshCcw,
    hasVideo: false,
    accent: {
      iconBg: "bg-violet-100 dark:bg-violet-500/10",
      iconBorder: "border-violet-200 dark:border-violet-500/20",
      icon: "text-violet-700 dark:text-violet-300",
    },
  },
  {
    key: "miniWebsite",
    icon: Brush,
    hasVideo: false,
    accent: {
      iconBg: "bg-rose-100 dark:bg-rose-500/10",
      iconBorder: "border-rose-200 dark:border-rose-500/20",
      icon: "text-rose-700 dark:text-rose-300",
    },
  },
  {
    key: "review",
    icon: ShieldCheck,
    hasVideo: false,
    accent: {
      iconBg: "bg-amber-100 dark:bg-amber-500/10",
      iconBorder: "border-amber-200 dark:border-amber-500/20",
      icon: "text-amber-700 dark:text-amber-300",
    },
  },
] as const;

const KANBAN_VIDEO_URL = "https://www.youtube.com/watch?v=aBiabxOg9Zo";

export default async function ComingSoonPage() {
  const t = await getTranslations("ComingSoonPage");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
        <div className="grid gap-6 px-6 py-8 lg:grid-cols-[1.25fr_0.9fr] lg:px-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Compass className="h-3.5 w-3.5" />
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
              <Button variant="outline" asChild>
                <a
                  href={KANBAN_VIDEO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("watchVideo")}
                </a>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl border bg-muted/20 p-4">
            <div className="rounded-2xl border bg-background px-4 py-4">
              <p className="text-sm font-semibold">{t("summaryTitle")}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t("summaryDescription")}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">
            {t("featuresTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("featuresDescription")}
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {FEATURE_META.map((feature, index) => {
            const Icon = feature.icon;

            return (
              <article
                key={feature.key}
                className="group rounded-2xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-muted/10 hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-colors ${feature.accent.iconBg} ${feature.accent.iconBorder}`}
                  >
                    <Icon className={`h-5 w-5 ${feature.accent.icon}`} />
                  </div>

                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <h3 className="text-base font-semibold">
                        {t(`features.${feature.key}.title`)}
                      </h3>
                      <Badge variant="warning" className="rounded-full">
                        {t("comingSoonBadge")}
                      </Badge>
                    </div>

                    <p className="text-sm leading-6 text-muted-foreground">
                      {t(`features.${feature.key}.description`)}
                    </p>

                    {feature.hasVideo ? (
                      <div className="inline-flex items-center gap-2 pt-1 text-sm font-medium text-foreground">
                        <a
                          href={KANBAN_VIDEO_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 hover:underline"
                        >
                          {t("watchVideo")}
                          <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </a>
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
