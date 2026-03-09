"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Menu, User, LayoutDashboard, Package, Settings, BookOpen, History, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, usePathname } from "@/i18n/routing";
import { createClient } from "@/utils/supabase/client";
import { signOut } from "@/app/actions/auth";

function TopbarClock() {
    const [now, setNow] = React.useState(new Date());
    React.useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);
    const dateStr = now.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
    const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
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
    const ref = React.useRef<HTMLDivElement>(null);
    const t = useTranslations("Topbar");
    const pathname = usePathname();

    const pageTitle = React.useMemo(() => {
        if (pathname.startsWith("/bookings/new")) return "Buat Booking";
        if (pathname.startsWith("/bookings/") && pathname.endsWith("/edit")) return "Edit Booking";
        if (pathname.startsWith("/bookings/")) return "Detail Booking";
        if (pathname.startsWith("/bookings")) return "Daftar Booking";
        if (pathname.startsWith("/calendar")) return "Kalender";
        if (pathname.startsWith("/finance")) return "Keuangan";
        if (pathname.startsWith("/services")) return "Layanan / Paket";
        if (pathname.startsWith("/team")) return "Tim / Freelance";
        if (pathname.startsWith("/form-booking")) return "Form Booking";
        if (pathname.startsWith("/settings")) return "Pengaturan";
        if (pathname.startsWith("/profile")) return "Profil";
        return "Client Desk";
    }, [pathname]);

    React.useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setProfileOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    React.useEffect(() => {
        async function fetchUser() {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserEmail(user.email || "");
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("full_name")
                    .eq("id", user.id)
                    .single();
                setUserName(profile?.full_name || user.email?.split("@")[0] || "User");
            }
        }
        fetchUser();
    }, []);

    const menuItems = [
        { label: t("profil"), href: "/profile", icon: User },
        { label: t("dashboard"), href: "/dashboard", icon: LayoutDashboard },
        { label: t("paket"), href: "/services", icon: Package },
        { label: t("pengaturan"), href: "/settings", icon: Settings },
    ];

    return (
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between shadow-[0_1px_5px_rgba(0,0,0,0.02)] bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 sm:px-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick}>
                    <Menu className="w-5 h-5" />
                    <span className="sr-only">Toggle Sidebar</span>
                </Button>
                <h1 className="text-lg font-semibold md:hidden">{pageTitle}</h1>
            </div>

            <div className="flex items-center gap-2">
                <TopbarClock />
                <LanguageSwitcher />
                <ThemeToggle />

                {/* Profile Avatar & Dropdown */}
                <div className="relative" ref={ref}>
                    <button
                        onClick={() => setProfileOpen(!profileOpen)}
                        className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-medium text-sm cursor-pointer hover:opacity-90 transition-opacity ml-1"
                    >
                        {userName ? userName.charAt(0).toUpperCase() : "U"}
                    </button>

                    <div
                        className={`absolute right-0 top-full mt-2 w-56 rounded-lg border bg-card shadow-lg z-50 overflow-hidden transition-all duration-200 ease-out origin-top-right ${profileOpen
                            ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
                            : "opacity-0 scale-95 -translate-y-1 pointer-events-none"
                            }`}
                    >
                        {/* Header */}
                        <div className="px-4 py-3 border-b">
                            <p className="font-semibold text-sm">{userName}</p>
                            <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                        </div>

                        {/* Menu Items */}
                        <div className="py-1">
                            {menuItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setProfileOpen(false)}
                                    className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors"
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
                                className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-muted/50 transition-colors w-full cursor-pointer"
                            >
                                <LogOut className="w-4 h-4" />
                                {t("logout")}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
