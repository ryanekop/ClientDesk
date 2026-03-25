import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import {
  ArrowLeft,
  BarChart3,
  Briefcase,
  Check,
  ExternalLink,
  Globe,
  Link2,
  Palette,
  Shield,
  Tag,
  X,
} from "lucide-react";

export default async function CustomDomainPage() {
  const t = await getTranslations("CustomDomain");

  const benefits = [
    {
      icon: Tag,
      color: "text-blue-500 bg-blue-500/10",
      title: t("page.brandTitle"),
      desc: t("page.brandDesc"),
    },
    {
      icon: Link2,
      color: "text-green-500 bg-green-500/10",
      title: t("page.urlTitle"),
      desc: t("page.urlDesc"),
    },
    {
      icon: BarChart3,
      color: "text-amber-500 bg-amber-500/10",
      title: t("page.seoTitle"),
      desc: t("page.seoDesc"),
    },
    {
      icon: Palette,
      color: "text-violet-500 bg-violet-500/10",
      title: t("page.customTitle"),
      desc: t("page.customDesc"),
    },
    {
      icon: Shield,
      color: "text-teal-500 bg-teal-500/10",
      title: t("page.separateTitle"),
      desc: t("page.separateDesc"),
    },
    {
      icon: Briefcase,
      color: "text-rose-500 bg-rose-500/10",
      title: t("page.proTitle"),
      desc: t("page.proDesc"),
    },
  ];

  const comparison = [
    {
      feature: t("page.compUrl"),
      without: "clientdesk.ryanekoapp.web.id/id/formbooking/studioname",
      with: "booking.namastudio.com/id/formbooking",
    },
    { feature: t("page.compBrand"), without: "❌", with: "✅" },
    { feature: t("page.compLogo"), without: "❌", with: "✅" },
    {
      feature: t("page.compTrust"),
      without: t("page.compTrustLow"),
      with: t("page.compTrustHigh"),
    },
    { feature: t("page.compSeo"), without: "❌", with: "✅" },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-10">
      <Link
        href="/settings"
        className="inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t("page.backToDashboard")}
      </Link>

      <section className="space-y-4 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-foreground shadow-xl">
          <Globe className="h-10 w-10 text-background" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {t("page.heroTitle")}
        </h1>
        <p className="mx-auto max-w-xl text-lg text-muted-foreground">
          {t("page.heroDesc")}
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {benefits.map((benefit) => (
          <div
            key={benefit.title}
            className="rounded-xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
          >
            <div
              className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${benefit.color}`}
            >
              <benefit.icon className="h-5 w-5" />
            </div>
            <h2 className="text-sm font-semibold">{benefit.title}</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {benefit.desc}
            </p>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="text-center text-xl font-bold">{t("page.compTitle")}</h2>
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="p-3 text-left font-medium text-muted-foreground">
                  {t("page.compFeature")}
                </th>
                <th className="p-3 text-center font-medium text-red-500">
                  <span className="inline-flex items-center gap-1">
                    <X className="h-4 w-4" />
                    {t("page.compWithout")}
                  </span>
                </th>
                <th className="p-3 text-center font-medium text-green-500">
                  <span className="inline-flex items-center gap-1">
                    <Check className="h-4 w-4" />
                    {t("page.compWith")}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row, index) => (
                <tr
                  key={row.feature}
                  className={index % 2 === 0 ? "bg-background" : "bg-muted/20"}
                >
                  <td className="p-3 font-medium">{row.feature}</td>
                  <td className="p-3 text-center text-xs text-muted-foreground">
                    {row.without}
                  </td>
                  <td className="p-3 text-center text-xs font-medium">
                    {row.with}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-center text-xl font-bold">{t("page.pricingTitle")}</h2>
        <div className="overflow-hidden rounded-xl border-2 border-foreground/20 bg-card transition-colors hover:border-foreground/40">
          <div className="bg-foreground px-6 py-7 text-center text-background">
            <p className="mb-2 text-sm opacity-80">{t("page.pricingSetup")}</p>
            <p className="text-lg opacity-60 line-through">Rp 200.000</p>
            <p className="text-4xl font-bold">Rp 150.000</p>
            <span className="mt-2 inline-flex rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white">
              🔥 10 orang tercepat
            </span>
            <p className="mt-2 text-sm opacity-70">{t("page.pricingOneTime")}</p>
            <p className="mt-1 text-sm font-semibold opacity-95">
              {t("page.pricingAppliesBoth")}
            </p>
          </div>

          <div className="space-y-3 p-6">
            <div className="flex items-start gap-3">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
              <div>
                <p className="text-sm font-medium">{t("page.pricingInc1")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("page.pricingInc1Desc")}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
              <div>
                <p className="text-sm font-medium">{t("page.pricingInc2")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("page.pricingInc2Desc")}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
              <div>
                <p className="text-sm font-medium">{t("page.pricingInc3")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("page.pricingInc3Desc")}
                </p>
              </div>
            </div>
            <div className="flex gap-2 rounded-lg border bg-muted p-3 text-sm">
              <span aria-hidden="true">💡</span>
              <p className="text-muted-foreground">{t("page.pricingDomainNote")}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4 pt-1 text-center">
        <h2 className="text-xl font-bold">{t("page.ctaTitle")}</h2>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          {t("page.ctaDesc")}
        </p>
        <a
          href="https://instagram.com/ryanekoapps"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-foreground px-6 py-3 font-semibold text-background transition-all hover:opacity-90 active:scale-95"
        >
          {t("page.ctaButton")}
          <ExternalLink className="h-4 w-4" />
        </a>
      </section>
    </div>
  );
}
