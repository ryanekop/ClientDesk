"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";

type LandingAuthProps = {
  isAuthenticated?: boolean;
};

function scrollToSection(id: string) {
  const element = document.getElementById(id);
  if (!element) return;

  element.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function DesktopNav() {
  const t = useTranslations("Landing");

  const navItems = [
    { label: t("navFeatures"), id: "features" },
    { label: t("navPricing"), id: "pricing" },
    { label: t("navFaq"), id: "faq" },
  ];

  return (
    <nav className="hidden md:flex items-center gap-1">
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => scrollToSection(item.id)}
          className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50 cursor-pointer"
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

export function MobileNav({ isAuthenticated = false }: LandingAuthProps) {
  const t = useTranslations("Landing");
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-mobile-nav]")) {
        setOpen(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [open]);

  const handleNav = useCallback((id: string) => {
    setOpen(false);
    setTimeout(() => scrollToSection(id), 80);
  }, []);

  const navItems = [
    { label: t("navFeatures"), id: "features" },
    { label: t("navPricing"), id: "pricing" },
    { label: t("navFaq"), id: "faq" },
  ];

  return (
    <div className="md:hidden" data-mobile-nav>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((prev) => !prev)}
        className="cursor-pointer"
        aria-label="Toggle menu"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{
              type: "spring",
              stiffness: 500,
              damping: 40,
              mass: 0.8,
            }}
            className="absolute top-[65px] left-4 right-4 z-50 rounded-2xl border bg-card shadow-xl overflow-hidden"
          >
            <div className="p-3">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className="w-full text-left px-4 py-4 text-base font-medium text-foreground hover:bg-muted/50 rounded-xl transition-colors cursor-pointer"
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="p-4 pt-2 border-t space-y-2">
              {isAuthenticated ? (
                <Button size="lg" asChild className="w-full gap-2 cursor-pointer">
                  <Link href={`/${locale}/dashboard`} onClick={() => setOpen(false)}>
                    {t("dashboard")} <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    size="lg"
                    asChild
                    className="w-full cursor-pointer"
                  >
                    <Link href={`/${locale}/register`} onClick={() => setOpen(false)}>
                      {t("navRegister")}
                    </Link>
                  </Button>
                  <Button size="lg" asChild className="w-full gap-2 cursor-pointer">
                    <Link href={`/${locale}/login`} onClick={() => setOpen(false)}>
                      {t("navLogin")} <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function LandingNav({ isAuthenticated = false }: LandingAuthProps) {
  const t = useTranslations("Landing");
  const locale = useLocale();

  if (isAuthenticated) {
    return (
      <Button variant="outline" asChild className="hidden md:inline-flex">
        <Link href={`/${locale}/dashboard`}>{t("dashboard")}</Link>
      </Button>
    );
  }

  return (
    <Button variant="outline" asChild className="hidden md:inline-flex">
      <Link href={`/${locale}/login`}>{t("loginAdmin")}</Link>
    </Button>
  );
}

export function HeroCTA({ isAuthenticated = false }: LandingAuthProps) {
  const t = useTranslations("Landing");
  const locale = useLocale();

  return (
    <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
      {isAuthenticated ? (
        <Button size="lg" asChild className="gap-2 cursor-pointer text-lg px-8">
          <Link href={`/${locale}/dashboard`}>
            🚀 {t("goToDashboard")} <ArrowRightIcon />
          </Link>
        </Button>
      ) : (
        <>
          <Button size="lg" asChild className="gap-2 cursor-pointer text-lg px-8">
            <Link href={`/${locale}/register`}>
              🚀 {t("startManaging")} <ArrowRightIcon />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="gap-2 cursor-pointer text-lg px-8"
            onClick={() => scrollToSection("features")}
          >
            ✨ {t("viewFeatures")}
          </Button>
        </>
      )}
    </div>
  );
}

export function BottomCTA({ isAuthenticated = false }: LandingAuthProps) {
  const t = useTranslations("Landing");
  const locale = useLocale();

  return (
    <Button size="lg" variant="secondary" asChild className="gap-2 text-lg px-8">
      <Link href={isAuthenticated ? `/${locale}/dashboard` : `/${locale}/register`}>
        🎉 {t("ctaButton")} <ArrowRightIcon />
      </Link>
    </Button>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
