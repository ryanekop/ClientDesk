"use client";

import * as React from "react";
import { Link, usePathname } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { signOut } from "@/app/actions/auth";
import { createClient } from "@/utils/supabase/client";
import { useLocale, useTranslations } from "next-intl";
import {
    LayoutDashboard,
    CalendarDays,
    Wallet,
    Settings,
    Users,
    Briefcase,
    X,
    ListOrdered,
    LogOut,
    Menu,
    FileEdit,
    Activity,
    ReceiptText,
    TicketPercent,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearClientDeskSessionOnlyState } from "@/lib/auth/session-only";

interface SidebarProps {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
}

const mainNavItems = [
    { titleKey: "dashboard" as const, href: "/dashboard", icon: LayoutDashboard },
    { titleKey: "bookings" as const, href: "/bookings", icon: ListOrdered },
    { titleKey: "statusKlien" as const, href: "/client-status", icon: Activity },
    { titleKey: "calendar" as const, href: "/calendar", icon: CalendarDays },
    { titleKey: "services" as const, href: "/services", icon: Briefcase },
    { titleKey: "finance" as const, href: "/finance", icon: Wallet },
    { titleKey: "team" as const, href: "/team", icon: Users },
    { titleKey: "formBooking" as const, href: "/form-booking", icon: FileEdit },
    { titleKey: "formSettlement" as const, href: "/settlement-form", icon: ReceiptText },
    { titleKey: "formSpecialBooking" as const, href: "/special-booking-form", icon: TicketPercent },
];

export function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
    const pathname = usePathname();
    const t = useTranslations("Sidebar");
    const locale = useLocale();
    const [isCollapsed, setIsCollapsed] = React.useState(false);
    const [userName, setUserName] = React.useState("");
    const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);
    const [avatarTs, setAvatarTs] = React.useState(() => Date.now());

    React.useEffect(() => {
        try {
            const saved = window.localStorage.getItem("clientdesk_sidebar_collapsed");
            if (saved === "true") setIsCollapsed(true);
        } catch {
            // Ignore storage read failures (e.g. strict privacy mode).
        }
    }, []);

    React.useEffect(() => {
        async function fetchUser() {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("full_name, avatar_url")
                    .eq("id", user.id)
                    .single();
                setUserName(profile?.full_name || user.email?.split("@")[0] || "User");
                setAvatarUrl(profile?.avatar_url || null);
                setAvatarTs(Date.now());
            }
        }
        fetchUser();
    }, []);

    const toggleCollapse = () => {
        const newVal = !isCollapsed;
        setIsCollapsed(newVal);
        try {
            window.localStorage.setItem("clientdesk_sidebar_collapsed", String(newVal));
        } catch {
            // Ignore storage write failures.
        }
    };

    const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

    const handleLogout = React.useCallback(() => {
        clearClientDeskSessionOnlyState();
        void signOut(locale);
    }, [locale]);

    return (
        <>
            {/* Mobile Drawer Overlay */}
            <div
                className={cn(
                    "fixed inset-x-0 bottom-0 top-[var(--global-announcement-height)] z-[70] bg-black/50 md:hidden transition-opacity duration-300 ease-out",
                    isOpen ? "opacity-100 visible" : "opacity-0 invisible"
                )}
                onClick={() => setIsOpen(false)}
            />

            <aside
                className={cn(
                    "fixed bottom-0 left-0 top-[var(--global-announcement-height)] z-[80] h-[calc(100dvh-var(--global-announcement-height))] bg-background shadow-[1px_0_5px_rgba(0,0,0,0.02)] transition-[transform,width] duration-300 ease-out md:static md:top-auto md:bottom-auto md:z-auto md:h-auto flex flex-col overflow-hidden whitespace-nowrap",
                    isCollapsed ? "w-16" : "w-64",
                    isOpen ? "translate-x-0 w-64" : "-translate-x-full md:translate-x-0"
                )}
            >
                <div className="flex items-center h-16 shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.02)] px-4">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="hidden md:flex rounded-md text-muted-foreground hover:bg-muted/50 transition-colors"
                            onClick={toggleCollapse}
                            title="Toggle Sidebar"
                        >
                            <Menu className="w-5 h-5 shrink-0" />
                            <span className="sr-only">Toggle Sidebar</span>
                        </Button>
                        <Link href="/dashboard" className={cn("flex items-center gap-2 transition-[opacity,width] duration-300", isCollapsed ? "opacity-0 invisible w-0" : "opacity-100 visible w-auto")}>
                            <img src="/icon-192.png" alt="Client Desk" className="w-7 h-7 rounded-lg" />
                            <span className="font-bold tracking-tight leading-none text-base">Client Desk</span>
                        </Link>
                    </div>
                    <Button variant="ghost" size="icon" className="md:hidden ml-auto" onClick={() => setIsOpen(false)}>
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Main Navigation */}
                <nav className="flex-1 overflow-y-auto py-4 px-2.5 space-y-1">
                    {mainNavItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setIsOpen(false)}
                            title={isCollapsed ? t(item.titleKey) : undefined}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                                isActive(item.href)
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            <item.icon className={cn("w-5 h-5 shrink-0", isActive(item.href) ? "text-primary-foreground" : "text-muted-foreground")} />
                            <span className={cn("transition-[opacity,width] duration-300", isCollapsed ? "opacity-0 invisible w-0" : "opacity-100 visible w-auto")}>
                                {t(item.titleKey)}
                            </span>
                        </Link>
                    ))}
                </nav>

                {/* Bottom: Settings + Profile */}
                <div className="mt-auto border-t">
                    {/* Settings */}
                    <div className="px-2.5 pt-2">
                        <Link
                            href="/settings"
                            onClick={() => setIsOpen(false)}
                            title={isCollapsed ? t("settings") : undefined}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                                isActive("/settings")
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            <Settings className={cn("w-5 h-5 shrink-0", isActive("/settings") ? "text-primary-foreground" : "text-muted-foreground")} />
                            <span className={cn("transition-[opacity,width] duration-300", isCollapsed ? "opacity-0 invisible w-0" : "opacity-100 visible w-auto")}>
                                {t("settings")}
                            </span>
                        </Link>
                    </div>

                    {/* Profile Section */}
                    <div className="p-3">
                        <div className="flex items-center gap-2">
                            <Link
                                href="/profile"
                                onClick={() => setIsOpen(false)}
                                title={isCollapsed ? userName : undefined}
                                className="flex items-center gap-3 flex-1 px-2 py-2 rounded-md hover:bg-muted transition-colors"
                            >
                                <div className="w-8 h-8 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-medium text-sm overflow-hidden">
                                    {avatarUrl ? (
                                        <img src={avatarUrl.startsWith('data:') ? avatarUrl : `${avatarUrl}${avatarUrl.includes('?') ? '&' : '?'}t=${avatarTs}`} alt={userName} className="w-full h-full object-cover" />
                                    ) : (
                                        userName ? userName.charAt(0).toUpperCase() : "U"
                                    )}
                                </div>
                                <div className={cn("flex-1 transition-[opacity,width] duration-300 min-w-0", isCollapsed ? "opacity-0 invisible w-0" : "opacity-100 visible w-auto")}>
                                    <p className="text-sm font-medium leading-none mb-1 truncate">{userName}</p>
                                    <p className="text-xs text-muted-foreground">{t("profile")}</p>
                                </div>
                            </Link>
                            <button
                                onClick={handleLogout}
                                title="Logout"
                                className={cn(
                                    "p-2 rounded-md hover:bg-muted transition-colors cursor-pointer shrink-0",
                                    isCollapsed ? "hidden" : ""
                                )}
                            >
                                <LogOut className="w-4 h-4 text-muted-foreground" />
                            </button>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
}
