import Image from "next/image";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import {
  ArrowLeft,
  ChevronDown,
  CreditCard,
  HelpCircle,
  Puzzle,
  Sparkles,
  Wrench,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LandingNav } from "@/components/landing/landing-client";
import { getTenantConfig } from "@/lib/tenant-config";
import { getIsAuthenticated } from "@/lib/auth/get-is-authenticated";

const categories = [
  {
    key: "categoryGeneral",
    icon: HelpCircle,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    questions: ["q1", "q2", "q3", "q4", "q5"],
  },
  {
    key: "categoryFeatures",
    icon: Puzzle,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    questions: ["q9", "q10", "q11"],
  },
  {
    key: "categoryPricing",
    icon: CreditCard,
    color: "text-green-500",
    bg: "bg-green-500/10",
    questions: ["q6", "q7", "q8"],
  },
  {
    key: "categoryTechnical",
    icon: Wrench,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    questions: ["q12"],
  },
] as const;

export default async function FAQPage() {
  const t = await getTranslations("FAQ");
  const tl = await getTranslations("Landing");
  const locale = await getLocale();
  const tenant = await getTenantConfig();
  const isAuthenticated = await getIsAuthenticated();

  return (
    <div className="flex flex-col min-h-screen font-sans">
      <header className="sticky top-0 z-50 flex items-center justify-between p-4 border-b bg-background/80 backdrop-blur-sm">
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
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          <LandingNav isAuthenticated={isAuthenticated} />
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-b from-background via-muted/30 to-background py-16 sm:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <Button variant="ghost" size="sm" asChild className="gap-1 mb-4">
              <Link href={`/${locale}`}>
                <ArrowLeft className="h-4 w-4" /> Home
              </Link>
            </Button>
            <Badge variant="secondary">
              <Sparkles className="h-3 w-3 mr-1" />
              FAQ
            </Badge>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">{t("pageTitle")}</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">{t("pageDescription")}</p>
          </div>
        </div>
      </section>

      <main className="flex-1 py-12 sm:py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto space-y-12">
            {categories.map((category) => {
              const IconComp = category.icon;
              return (
                <div key={category.key}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`h-10 w-10 rounded-lg ${category.bg} flex items-center justify-center`}>
                      <IconComp className={`h-5 w-5 ${category.color}`} />
                    </div>
                    <h2 className="text-xl font-bold">{t(category.key)}</h2>
                  </div>

                  <div className="space-y-3">
                    {category.questions.map((questionKey) => (
                      <details key={questionKey} className="rounded-xl border bg-card group">
                        <summary className="list-none cursor-pointer p-5">
                          <div className="flex items-center justify-between gap-4">
                            <h3 className="font-semibold text-base sm:text-lg">{t(questionKey)}</h3>
                            <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
                          </div>
                        </summary>
                        <div className="px-5 pb-5 border-t">
                          <p className="text-muted-foreground mt-3 text-sm sm:text-base leading-relaxed">
                            {t(questionKey.replace("q", "a") as `a${string}`)}
                          </p>
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-center mt-20 max-w-lg mx-auto bg-muted/30 rounded-2xl p-8">
            <h3 className="text-xl font-bold mb-2">{t("stillHaveQuestions")}</h3>
            <a
              href="https://instagram.com/ryanekoapps"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
            >
              📩 {t("contactUs")}
            </a>
          </div>
        </div>
      </main>

      <footer className="py-8 border-t text-center text-sm text-muted-foreground">
        {tenant.footerText ? (
          <p dangerouslySetInnerHTML={{ __html: tenant.footerText }} />
        ) : (
          <p>
            © {new Date().getFullYear()} {tenant.name}. {tl("footerMadeWith")} {" "}
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
      </footer>
    </div>
  );
}
