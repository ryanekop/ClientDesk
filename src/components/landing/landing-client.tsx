"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Crown,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  User,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { User as SupabaseUser } from "@supabase/supabase-js";

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

export function LandingNav() {
  const tLanding = useTranslations("Landing");
  const tTopbar = useTranslations("Topbar");
  const locale = useLocale();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [userName, setUserName] = useState("Admin");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarTs, setAvatarTs] = useState(() => Date.now());
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const loadUserState = useCallback(async () => {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      setUser(null);
      setAvatarUrl(null);
      setUserName("Admin");
      return;
    }

    setUser(currentUser);
    setUserName(
      currentUser.user_metadata?.full_name ||
        currentUser.email?.split("@")[0] ||
        "Admin",
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", currentUser.id)
      .single();

    if (profile?.full_name) {
      setUserName(profile.full_name);
    }
    setAvatarUrl(profile?.avatar_url || null);
    setAvatarTs(Date.now());
  }, [supabase]);

  useEffect(() => {
    void loadUserState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadUserState();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadUserState, supabase]);

  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);
    await supabase.auth.signOut();
    setUser(null);
    setAvatarUrl(null);
    setUserName("Admin");
    setMenuOpen(false);
    router.refresh();
    setIsLoggingOut(false);
  }, [router, supabase]);

  if (user) {
    return (
      <div className="relative" ref={menuRef}>
        <Button
          variant="ghost"
          onClick={() => setMenuOpen((prev) => !prev)}
          className="relative h-9 w-9 rounded-full bg-muted flex items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors overflow-hidden p-0"
        >
          {avatarUrl ? (
            <img
              src={
                avatarUrl.startsWith("data:")
                  ? avatarUrl
                  : `${avatarUrl}${avatarUrl.includes("?") ? "&" : "?"}t=${avatarTs}`
              }
              alt="Avatar"
              className="absolute inset-0 w-full h-full object-cover rounded-full"
            />
          ) : (
            <span className="text-xs font-medium">{getInitials(userName)}</span>
          )}
        </Button>
        <div
          className={`absolute right-0 top-full mt-2 w-56 rounded-lg border bg-card shadow-lg z-50 overflow-hidden transition-all duration-200 ease-out origin-top-right ${
            menuOpen
              ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
              : "opacity-0 scale-95 -translate-y-1 pointer-events-none"
          }`}
        >
          <div className="px-4 py-3 border-b">
            <p className="text-sm font-medium leading-none">{userName}</p>
            <p className="text-xs leading-none text-muted-foreground mt-1">
              {user.email || "admin@example.com"}
            </p>
          </div>
          <div className="py-1">
            <button
              onClick={() => {
                setMenuOpen(false);
                router.push(`/${locale}/profile`);
              }}
              className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted/50 transition-colors w-full text-left cursor-pointer"
            >
              <User className="w-4 h-4 text-muted-foreground" />
              {tTopbar("profil")}
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                router.push(`/${locale}/dashboard`);
              }}
              className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted/50 transition-colors w-full text-left cursor-pointer"
            >
              <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
              {tTopbar("dashboard")}
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                router.push(`/${locale}/pricing`);
              }}
              className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted/50 transition-colors w-full text-left cursor-pointer"
            >
              <Crown className="w-4 h-4 text-muted-foreground" />
              {tTopbar("paket")}
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                router.push(`/${locale}/settings`);
              }}
              className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted/50 transition-colors w-full text-left cursor-pointer"
            >
              <Settings className="w-4 h-4 text-muted-foreground" />
              {tTopbar("pengaturan")}
            </button>
          </div>
          <div className="border-t py-1">
            <button
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
              className="flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-muted/50 transition-colors w-full text-left cursor-pointer disabled:opacity-60"
            >
              <LogOut className="w-4 h-4" />
              {isLoggingOut ? "Logging out..." : tTopbar("logout")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Button variant="outline" asChild className="hidden md:inline-flex">
      <Link href={`/${locale}/login`}>{tLanding("loginAdmin")}</Link>
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
