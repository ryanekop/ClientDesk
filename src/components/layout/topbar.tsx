"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import {
  Menu,
  User,
  LayoutDashboard,
  Crown,
  Settings,
  LogOut,
  Megaphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, usePathname } from "@/i18n/routing";
import { createClient } from "@/utils/supabase/client";
import { signOut } from "@/app/actions/auth";
import { useChangelogUnread } from "@/components/changelog-modal";

function TopbarClock() {
  const [now, setNow] = React.useState<Date | null>(null);

  React.useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!now) {
    return (
      <div
        className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground tabular-nums mr-1"
        aria-hidden="true"
      >
        <span className="font-medium opacity-0">Kam, 12 Mar</span>
        <span className="text-foreground font-bold opacity-0">23.59.59</span>
      </div>
    );
  }

  const dateStr = now.toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const timeStr = now.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return (
    <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground tabular-nums mr-1">
      <span className="font-medium">{dateStr}</span>
      <span className="text-foreground font-bold">{timeStr}</span>
    </div>
  );
}

interface TopbarProps {
  onMenuClick: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [userName, setUserName] = React.useState("");
  const [userEmail, setUserEmail] = React.useState("");
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);
  const [avatarTs, setAvatarTs] = React.useState(() => Date.now());
  const [subscription, setSubscription] = React.useState<{
    tier: string;
    status: string;
  } | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);
  const t = useTranslations("Topbar");
  const pathname = usePathname();
  const { hasUnread } = useChangelogUnread();

  const pageTitle = React.useMemo(() => {
    if (pathname.startsWith("/bookings/new")) return "Buat Booking";
    if (pathname.startsWith("/bookings/") && pathname.endsWith("/edit"))
      return "Edit Booking";
    if (pathname.startsWith("/bookings/")) return "Detail Booking";
    if (pathname.startsWith("/bookings")) return "Daftar Booking";
    if (pathname.startsWith("/calendar")) return "Kalender";
    if (pathname.startsWith("/finance")) return "Keuangan";
    if (pathname.startsWith("/services")) return "Layanan / Paket";
    if (pathname.startsWith("/team")) return "Tim / Freelance";
    if (pathname.startsWith("/form-booking")) return "Form Booking";
    if (pathname.startsWith("/client-status")) return "Status Booking";
    if (pathname.startsWith("/changelog")) return "Log Perubahan";
    if (pathname.startsWith("/settings")) return "Pengaturan";
    if (pathname.startsWith("/profile")) return "Profil";
    if (pathname.startsWith("/dashboard")) return "Dashboard";
    return "Client Desk";
  }, [pathname]);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  React.useEffect(() => {
    async function fetchUser() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || "");
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, avatar_url")
          .eq("id", user.id)
          .single();
        setUserName(profile?.full_name || user.email?.split("@")[0] || "User");
        setAvatarUrl(profile?.avatar_url || null);
        setAvatarTs(Date.now());

        // Fetch subscription status
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("tier, status")
          .eq("user_id", user.id)
          .single();
        setSubscription(sub);
      }
    }
    fetchUser();
  }, []);

  const getMembershipBadge = () => {
    if (!subscription) return null;
    const isLifetime = subscription.tier === "lifetime";
    const isPro = subscription.tier.startsWith("pro_") || isLifetime;
    const isTrial =
      subscription.status === "trial" || subscription.tier === "free";

    if (isPro) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium">
          {isLifetime ? "👑" : "🔥"} Pro
        </span>
      );
    }
    if (isTrial) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] bg-muted text-muted-foreground font-medium border">
          ⏱️ Trial
        </span>
      );
    }
    return null;
  };

  const menuItems = [
    { label: t("profil"), href: "/profile", icon: User },
    { label: t("dashboard"), href: "/dashboard", icon: LayoutDashboard },
    { label: t("paket"), href: "/pricing", icon: Crown },
    { label: t("pengaturan"), href: "/settings", icon: Settings },
  ];

  return (
    <>
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between shadow-[0_1px_5px_rgba(0,0,0,0.02)] bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 sm:px-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMenuClick}
        >
          <Menu className="w-5 h-5" />
          <span className="sr-only">Toggle Sidebar</span>
        </Button>
        <h1 className="text-lg font-semibold md:hidden">{pageTitle}</h1>
      </div>

      <div className="flex items-center gap-2">
        <TopbarClock />
        <LanguageSwitcher />
        <ThemeToggle />
        <Button
          variant="outline"
          asChild
          className="relative gap-2 rounded-md px-3"
        >
          <Link href="/changelog">
            <Megaphone className="h-4 w-4 text-muted-foreground" />
            <span className="hidden text-sm font-medium sm:inline">
              Log Perubahan
            </span>
            {hasUnread && (
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-emerald-500 sm:static sm:ml-1" />
            )}
          </Link>
        </Button>

        {/* Profile Avatar & Dropdown */}
        <div className="relative" ref={ref}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-medium text-sm cursor-pointer hover:opacity-90 transition-opacity ml-1 overflow-hidden"
          >
            {avatarUrl ? (
              <img
                src={
                  avatarUrl.startsWith("data:")
                    ? avatarUrl
                    : `${avatarUrl}${avatarUrl.includes("?") ? "&" : "?"}t=${avatarTs}`
                }
                alt={userName}
                className="w-full h-full object-cover"
              />
            ) : userName ? (
              userName.charAt(0).toUpperCase()
            ) : (
              "U"
            )}
          </button>

          <div
            className={`absolute right-0 top-full mt-2 w-56 rounded-lg border bg-card shadow-lg z-50 overflow-hidden transition-all duration-200 ease-out origin-top-right ${
              profileOpen
                ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
                : "opacity-0 scale-95 -translate-y-1 pointer-events-none"
            }`}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm">{userName}</p>
                {getMembershipBadge()}
              </div>
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
                  onClick={() => setProfileOpen(false)}
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
                onClick={() => signOut()}
                className="flex items-center gap-3 px-4 py-2 text-sm text-red-500 hover:bg-muted/50 transition-colors w-full cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                {t("logout")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
    </>
  );
}
