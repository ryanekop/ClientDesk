import Image from "next/image";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  Clock,
  DollarSign,
  FileText,
  FolderOpen,
  FolderPlus,
  Globe,
  PenLine,
  Search,
  BellOff,
  MessageSquare,
  Share2,
  Sparkles,
  Zap,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BottomCTA,
  DesktopNav,
  HeroCTA,
  LandingNav,
  MobileNav,
} from "@/components/landing/landing-client";
import { Card, CardContent } from "@/components/ui/card";
import { getTenantConfig } from "@/lib/tenant-config";
import { getIsAuthenticated } from "@/lib/auth/get-is-authenticated";

type ProblemKey = "1" | "2" | "3" | "4" | "5" | "6";

const problemItems: {
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
  { key: "6", icon: DollarSign, color: "text-green-500", bg: "bg-green-500/10" },
];

const featureItems = [
  {
    icon: CalendarCheck,
    titleKey: "feature1Title",
    descKey: "feature1Desc",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    icon: FileText,
    titleKey: "feature2Title",
    descKey: "feature2Desc",
    color: "text-green-500",
    bg: "bg-green-500/10",
  },
  {
    icon: MessageSquare,
    titleKey: "feature3Title",
    descKey: "feature3Desc",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    icon: Zap,
    titleKey: "feature4Title",
    descKey: "feature4Desc",
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
  },
  {
    icon: FolderOpen,
    titleKey: "feature5Title",
    descKey: "feature5Desc",
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
  },
  {
    icon: Globe,
    titleKey: "feature6Title",
    descKey: "feature6Desc",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
] as const;

const workflowSteps = [
  { icon: FolderPlus, titleKey: "step1Title", descKey: "step1Desc", step: "1" },
  { icon: Share2, titleKey: "step2Title", descKey: "step2Desc", step: "2" },
  {
    icon: CheckCircle2,
    titleKey: "step3Title",
    descKey: "step3Desc",
    step: "3",
  },
] as const;

const landingFaqKeys = ["q1", "q2", "q3", "q4", "q6", "q9"] as const;

export default async function Home() {
  const t = await getTranslations("Landing");
  const faq = await getTranslations("FAQ");
  const locale = await getLocale();
  const tenant = await getTenantConfig();
  const isAuthenticated = await getIsAuthenticated();

  return (
    <div className="flex flex-col min-h-screen font-sans">
      <header className="sticky top-0 z-50 flex items-center justify-between p-4 border-b bg-background/80 backdrop-blur-sm relative">
        <Link
          href={`/${locale}`}
          className="font-bold text-xl tracking-tight flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <Image
            src={tenant.logoUrl || "/icon-192.png"}
            alt={tenant.name}
            width={32}
            height={32}
            sizes="32px"
            className="h-8 w-8 rounded-lg"
          />
          {tenant.name}
        </Link>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <DesktopNav />
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          <LandingNav isAuthenticated={isAuthenticated} />
          <MobileNav isAuthenticated={isAuthenticated} />
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-b from-background via-muted/30 to-background py-20 sm:py-32">
        <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none" />

        <div className="container mx-auto px-4">
          <div className="text-center space-y-6 max-w-4xl mx-auto">
            <Badge variant="secondary" className="mb-4">
              <Sparkles className="h-3 w-3 mr-1" />
              {t("heroTagline")}
            </Badge>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight">
              {t("title")}
              <span className="block text-primary mt-2">{t("subtitle")}</span>
            </h1>

            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t("description")}
            </p>

            <HeroCTA isAuthenticated={isAuthenticated} />

            <p className="text-sm text-muted-foreground pt-4">✨ {t("trustedBy")}</p>
          </div>
        </div>
      </section>

      <section id="problems" className="py-20 bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t("problemTitle")}</h2>
            <p className="text-muted-foreground text-lg">{t("problemSubtitle")}</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {problemItems.map((problem) => {
              const Icon = problem.icon;
              return (
                <Card key={problem.key} className="h-full hover:shadow-lg transition-shadow">
                  <CardContent className="pt-6">
                    <div
                      className={`h-12 w-12 rounded-lg ${problem.bg} flex items-center justify-center mb-4`}
                    >
                      <Icon className={`h-6 w-6 ${problem.color}`} />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">
                      {t(`problem${problem.key}Title` as `problem${ProblemKey}Title`)}
                    </h3>
                    <p className="text-muted-foreground">
                      {t(`problem${problem.key}Desc` as `problem${ProblemKey}Desc`)}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section id="features" className="py-20 scroll-mt-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t("featuresTitle")}</h2>
            <p className="text-muted-foreground text-lg">{t("featuresSubtitle")}</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {featureItems.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.titleKey} className="h-full hover:shadow-lg transition-shadow">
                  <CardContent className="pt-6">
                    <div
                      className={`h-12 w-12 rounded-lg ${feature.bg} flex items-center justify-center mb-4`}
                    >
                      <Icon className={`h-6 w-6 ${feature.color}`} />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{t(feature.titleKey)}</h3>
                    <p className="text-muted-foreground">{t(feature.descKey)}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="text-center mt-10">
            <Button variant="outline" size="lg" asChild className="gap-2">
              <Link href={`/${locale}/features`}>
                ✨ {t("seeAllFeatures")} <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section id="workflow" className="py-20 bg-muted/20 scroll-mt-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t("workflowTitle")}</h2>
            <p className="text-muted-foreground text-lg">{t("workflowSubtitle")}</p>
          </div>

          <div className="flex flex-col md:flex-row gap-8 justify-center items-center max-w-4xl mx-auto">
            {workflowSteps.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.step} className="flex flex-col items-center text-center flex-1">
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
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section
        id="pricing"
        className="py-20 bg-gradient-to-b from-background to-muted/30 scroll-mt-20"
      >
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t("pricingTitle")}</h2>
            <p className="text-muted-foreground text-lg mb-8">{t("pricingSubtitle")}</p>

            <Button size="lg" variant="outline" asChild className="gap-2">
              <Link href={`/${locale}/pricing`}>
                👀 {t("pricingCta")} <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section id="faq" className="py-20 bg-muted/20 scroll-mt-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t("faqSectionTitle")}</h2>
            <p className="text-muted-foreground text-lg">{t("faqSectionSubtitle")}</p>
          </div>

          <div className="max-w-3xl mx-auto space-y-3">
            {landingFaqKeys.map((key) => (
              <details key={key} className="rounded-xl border bg-card group">
                <summary className="list-none cursor-pointer p-5">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="font-semibold text-base sm:text-lg">{faq(key)}</h3>
                    <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
                  </div>
                </summary>
                <div className="px-5 pb-5 border-t">
                  <p className="text-muted-foreground mt-3 text-sm sm:text-base leading-relaxed">
                    {faq(key.replace("q", "a") as `a${string}`)}
                  </p>
                </div>
              </details>
            ))}
          </div>

          <div className="text-center mt-10">
            <Button variant="outline" size="lg" asChild className="gap-2">
              <Link href={`/${locale}/faq`}>
                ❓ {t("faqSeeAll")} <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto bg-primary rounded-3xl p-8 sm:p-12 text-primary-foreground">
            <p className="text-primary-foreground/60 text-sm font-medium mb-3 uppercase tracking-wider">
              ⏰ {t("trialBadge")}
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t("ctaTitle")}</h2>
            <p className="text-primary-foreground/80 text-lg mb-8">{t("ctaSubtitle")}</p>
            <BottomCTA isAuthenticated={isAuthenticated} />
            <p className="text-primary-foreground/50 text-xs mt-4">{t("ctaTrialNote")}</p>
          </div>
        </div>
      </section>

      <footer className="py-12 border-t bg-muted/10">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-2 md:col-span-1">
              <h3 className="font-bold text-lg mb-3">{tenant.name}</h3>
              <p className="text-sm text-muted-foreground">
                {t("description").substring(0, 80)}...
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-3 text-muted-foreground uppercase tracking-wider">
                {t("footerProduct")}
              </h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    href={`/${locale}/features`}
                    className="text-foreground/70 hover:text-foreground transition-colors"
                  >
                    {t("footerFeatures")}
                  </Link>
                </li>
                <li>
                  <Link
                    href={`/${locale}/pricing`}
                    className="text-foreground/70 hover:text-foreground transition-colors"
                  >
                    {t("footerPricing")}
                  </Link>
                </li>
                <li>
                  <Link
                    href={`/${locale}/faq`}
                    className="text-foreground/70 hover:text-foreground transition-colors"
                  >
                    {t("footerFaq")}
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-3 text-muted-foreground uppercase tracking-wider">
                {t("footerLegal")}
              </h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    href={`/${locale}/terms`}
                    className="text-foreground/70 hover:text-foreground transition-colors"
                  >
                    {t("footerTerms")}
                  </Link>
                </li>
                <li>
                  <Link
                    href={`/${locale}/privacy`}
                    className="text-foreground/70 hover:text-foreground transition-colors"
                  >
                    {t("footerPrivacy")}
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-3 text-muted-foreground uppercase tracking-wider">
                {t("footerSocial")}
              </h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="https://instagram.com/ryanekoapps"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground/70 hover:text-foreground transition-colors"
                  >
                    Instagram
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t pt-6 text-center text-sm text-muted-foreground">
            {tenant.footerText ? (
              <p dangerouslySetInnerHTML={{ __html: tenant.footerText }} />
            ) : (
              <p>
                © {new Date().getFullYear()} {tenant.name}. {t("footerMadeWith")}{" "}
                <a
                  href="https://instagram.com/ryanekopram"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  @ryanekopram
                </a>{" "}
                &{" "}
                <a
                  href="https://instagram.com/ryanekoapps"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  @ryanekoapps
                </a>
              </p>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
