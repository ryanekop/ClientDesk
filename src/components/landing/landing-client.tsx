"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  createContext,
  useContext,
} from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import {
  Loader2,
  LogOut,
  Settings,
  LayoutDashboard,
  User,
  Menu,
  X,
  ArrowRight,
} from "lucide-react";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";

// ─── Shared Auth Context ──────────────────────────────────────────────────────
// Satu getUser() call dibagi ke semua komponen landing, bukan 4x terpisah

type LandingUserProfile = {
  full_name: string | null;
  avatar_url: string | null;
};

type LandingUserContextType = {
  user: SupabaseUser | null;
  profile: LandingUserProfile | null;
  loading: boolean;
};

const LandingUserContext = createContext<LandingUserContextType>({
  user: null,
  profile: null,
  loading: true,
});

function useLandingUser() {
  return useContext(LandingUserContext);
}

export function LandingUserProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<LandingUserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("full_name, avatar_url")
          .eq("id", user.id)
          .single();
        setProfile(data ?? null);
      }

      setLoading(false);
    }

    init();
  }, []);

  return (
    <LandingUserContext.Provider value={{ user, profile, loading }}>
      {children}
    </LandingUserContext.Provider>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

// ─── DesktopNav ───────────────────────────────────────────────────────────────

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

// ─── MobileNav ────────────────────────────────────────────────────────────────

export function MobileNav() {
  const t = useTranslations("Landing");
  const locale = useLocale();
  const { user } = useLandingUser(); // ← shared context, no extra getUser()
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-mobile-nav]")) {
        setOpen(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [open]);

  const handleNav = useCallback((id: string) => {
    setOpen(false);
    setTimeout(() => scrollToSection(id), 100);
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
        onClick={() => setOpen(!open)}
        className="cursor-pointer"
        aria-label="Toggle menu"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      <AnimatePresence>
        {open && (
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
              {user ? (
                <Button
                  size="lg"
                  asChild
                  className="w-full gap-2 cursor-pointer"
                >
                  <Link
                    href={`/${locale}/dashboard`}
                    onClick={() => setOpen(false)}
                  >
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
                    <Link
                      href={`/${locale}/register`}
                      onClick={() => setOpen(false)}
                    >
                      {t("navRegister")}
                    </Link>
                  </Button>
                  <Button
                    size="lg"
                    asChild
                    className="w-full gap-2 cursor-pointer"
                  >
                    <Link
                      href={`/${locale}/login`}
                      onClick={() => setOpen(false)}
                    >
                      {t("navLogin")} <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── LandingNav (avatar dropdown) ────────────────────────────────────────────

export function LandingNav() {
  const t = useTranslations("Landing");
  const tt = useTranslations("Topbar");
  const locale = useLocale();
  const router = useRouter();
  const supabase = createClient();
  const { user, profile, loading } = useLandingUser(); // ← shared context
  // Cek hash saat inisialisasi — hindari setState synchronous di dalam effect
  const [isAuthenticating, setIsAuthenticating] = useState(() => {
    if (typeof window === "undefined") return false;
    const hash = window.location.hash;
    if (!hash) return false;
    return !!new URLSearchParams(hash.substring(1)).get("access_token");
  });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Redirect ke callback page jika ada OAuth hash token
  useEffect(() => {
    if (isAuthenticating) {
      router.push(`/${locale}/auth/callback${window.location.hash}`);
    }
  }, [isAuthenticating, locale, router]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const handleLogout = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    setDropdownOpen(false);
    router.refresh();
    setSigningOut(false);
  };

  if (isAuthenticating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Authenticating...</p>
        </div>
      </div>
    );
  }

  const userName = profile?.full_name || user?.email?.split("@")[0] || "Admin";
  const userEmail = user?.email || "";
  const avatarUrl = profile?.avatar_url ?? null;

  const menuItems = [
    { label: tt("profil"), href: `/${locale}/profile`, icon: User },
    {
      label: tt("dashboard"),
      href: `/${locale}/dashboard`,
      icon: LayoutDashboard,
    },
    { label: tt("pengaturan"), href: `/${locale}/settings`, icon: Settings },
  ];

  return (
    <>
      {!loading && user ? (
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="relative h-9 w-9 rounded-full bg-muted flex items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors overflow-hidden"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                className="absolute inset-0 w-full h-full object-cover rounded-full"
              />
            ) : (
              <span className="text-xs font-medium">
                {getInitials(userName)}
              </span>
            )}
          </button>

          <div
            className={`absolute right-0 top-full mt-2 w-56 rounded-lg border bg-card shadow-lg z-50 overflow-hidden transition-all duration-200 ease-out origin-top-right ${
              dropdownOpen
                ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
                : "opacity-0 scale-95 -translate-y-1 pointer-events-none"
            }`}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b">
              <p className="font-semibold text-sm">{userName}</p>
              <p className="text-xs text-muted-foreground truncate">
                {userEmail}
              </p>
            </div>

            {/* Menu Items */}
            <div className="py-1">
              {menuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted/50 transition-colors"
                >
                  <item.icon className="w-4 h-4 text-muted-foreground" />
                  {item.label}
                </Link>
              ))}
            </div>

            {/* Logout */}
            <div className="border-t py-1">
              <button
                onClick={handleLogout}
                disabled={signingOut}
                className="flex items-center gap-3 px-4 py-2 text-sm text-red-500 hover:bg-muted/50 transition-colors w-full cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                {tt("logout")}
              </button>
            </div>
          </div>
        </div>
      ) : (
        !loading && (
          <Button variant="outline" asChild className="hidden md:inline-flex">
            <Link href={`/${locale}/login`}>{t("loginAdmin")}</Link>
          </Button>
        )
      )}
    </>
  );
}

// ─── HeroCTA ─────────────────────────────────────────────────────────────────

export function HeroCTA() {
  const t = useTranslations("Landing");
  const locale = useLocale();
  const { user, loading } = useLandingUser(); // ← shared context

  if (loading) {
    // Placeholder biar layout tidak lompat-lompat saat load
    return <div className="h-14 pt-4" />;
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
      {user ? (
        <Button size="lg" asChild className="gap-2 cursor-pointer text-lg px-8">
          <Link href={`/${locale}/dashboard`}>
            🚀 {t("goToDashboard")} <ArrowRightIcon />
          </Link>
        </Button>
      ) : (
        <>
          <Button
            size="lg"
            asChild
            className="gap-2 cursor-pointer text-lg px-8"
          >
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

// ─── BottomCTA ────────────────────────────────────────────────────────────────

export function BottomCTA() {
  const t = useTranslations("Landing");
  const locale = useLocale();
  const { user } = useLandingUser(); // ← shared context

  return (
    <Button
      size="lg"
      variant="secondary"
      asChild
      className="gap-2 text-lg px-8"
    >
      <Link href={user ? `/${locale}/dashboard` : `/${locale}/register`}>
        🎉 {t("ctaButton")} <ArrowRightIcon />
      </Link>
    </Button>
  );
}

// ─── Shared icon ──────────────────────────────────────────────────────────────

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
