import {
  ArrowLeft,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  CreditCard,
  FolderKanban,
  HelpCircle,
  LayoutDashboard,
  ListOrdered,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/routing";
import { OpenSetupGuideButton } from "@/components/tutorial/open-setup-guide-button";
import {
  getTutorialTopicBySlug,
  TUTORIAL_TOPICS,
  type TutorialTopicIconKey,
} from "@/lib/tutorial";

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

const DETAIL_SECTION_KEYS = ["understand", "whenToUse", "quickTips"] as const;

export async function generateStaticParams() {
  return TUTORIAL_TOPICS.map((topic) => ({ topic: topic.slug }));
}

export default async function TutorialTopicDetailPage({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  const { topic: topicSlug } = await params;
  const topic = getTutorialTopicBySlug(topicSlug);

  if (!topic) {
    notFound();
  }

  const t = await getTranslations("Tutorial");
  const Icon = TOPIC_ICON_MAP[topic.icon];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <ButtonLinkBack label={t("backToTutorial")} />
        <div className="hidden sm:flex">
          <OpenSetupGuideButton label={t("openSetup")} variant="outline" />
        </div>
      </div>

      <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
        <div className="space-y-5 px-6 py-8 sm:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5" />
            {t("badge")}
          </div>

          <div className="flex items-start gap-4">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${topic.accent.iconBg} ${topic.accent.iconBorder}`}
            >
              <Icon className={`h-5 w-5 ${topic.accent.icon}`} />
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight">
                {t(`topics.${topic.id}.title`)}
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
                {t(`topics.${topic.id}.description`)}
              </p>
            </div>
          </div>

          <div className="grid gap-4 rounded-2xl border border-dashed bg-muted/20 p-4 sm:grid-cols-3">
            {DETAIL_SECTION_KEYS.map((sectionKey) => (
              <div key={sectionKey} className="rounded-2xl border bg-background px-4 py-4">
                <p className="text-sm font-semibold">
                  {t(`detailSectionTitles.${sectionKey}`)}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t(`topics.${topic.id}.details.${sectionKey}`)}
                </p>
              </div>
            ))}
          </div>

          <section className="space-y-4 rounded-2xl border bg-background px-5 py-5">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight">
                {t("stepsTitle")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("stepsDescription")}
              </p>
            </div>

            <div className="space-y-3">
              {topic.stepKeys.map((stepKey, index) => (
                <div
                  key={stepKey}
                  className="flex items-start gap-4 rounded-2xl border bg-muted/10 px-4 py-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background text-sm font-semibold text-foreground">
                    {index + 1}
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-semibold sm:text-base">
                      {t(`topics.${topic.id}.steps.${stepKey}.title`)}
                    </h3>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {t(`topics.${topic.id}.steps.${stepKey}.description`)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border bg-muted/15 px-5 py-5">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight">
                {t("notesTitle")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("notesDescription")}
              </p>
            </div>

            <div className="space-y-3">
              {topic.noteKeys.map((noteKey) => (
                <div
                  key={noteKey}
                  className="rounded-2xl border border-dashed bg-background px-4 py-4 text-sm leading-6 text-muted-foreground"
                >
                  {t(`topics.${topic.id}.notes.${noteKey}`)}
                </div>
              ))}
            </div>
          </section>

          <div className="flex flex-col gap-3 sm:hidden">
            <OpenSetupGuideButton label={t("openSetup")} variant="outline" />
          </div>
        </div>
      </section>
    </div>
  );
}

function ButtonLinkBack({ label }: { label: string }) {
  return (
    <Link
      href="/tutorial"
      className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Link>
  );
}
