"use client";

import * as React from "react";
import type { BookingWriteAccessState } from "@/lib/booking-write-access";
import { BookingWriteAccessProvider } from "@/lib/booking-write-access-context";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { DashboardTitleSync } from "./dashboard-title-sync";
import { OnboardingTour } from "@/components/onboarding/onboarding-tour";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import {
    CLIENTDESK_SESSION_ONLY_MODE_KEY,
    clearClientDeskSessionOnlyState,
    evaluateClientDeskSessionOnlyState,
    isClientDeskSessionOnlyModeEnabled,
} from "@/lib/auth/session-only";

interface DashboardLayoutProps {
    children: React.ReactNode;
    bookingWriteAccess: BookingWriteAccessState;
}

export function DashboardLayout({
    children,
    bookingWriteAccess,
}: DashboardLayoutProps) {
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
    const supabase = React.useMemo(() => createClient(), []);
    const router = useRouter();
    const locale = useLocale();
    const signingOutRef = React.useRef(false);
    const isCheckingRef = React.useRef(false);
    const layoutStyle = React.useMemo(
        () =>
            ({
                "--dashboard-topbar-height": "64px",
                height: "calc(100vh - var(--global-announcement-height, 0px))",
            }) as React.CSSProperties,
        [],
    );

    const enforceSessionOnly = React.useCallback(async () => {
        if (signingOutRef.current || isCheckingRef.current) return;
        if (!isClientDeskSessionOnlyModeEnabled()) return;

        isCheckingRef.current = true;

        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;

            const { shouldSignOut } = evaluateClientDeskSessionOnlyState(user.id);
            if (!shouldSignOut) return;

            signingOutRef.current = true;
            clearClientDeskSessionOnlyState();
            await supabase.auth.signOut();
            router.replace(`/${locale}/login`);
        } finally {
            isCheckingRef.current = false;
        }
    }, [locale, router, supabase]);

    React.useEffect(() => {
        void enforceSessionOnly();

        let interval: number | null = null;

        const stopInterval = () => {
            if (interval === null) return;
            window.clearInterval(interval);
            interval = null;
        };

        const startInterval = () => {
            if (interval !== null || !isClientDeskSessionOnlyModeEnabled()) return;
            interval = window.setInterval(() => {
                if (!isClientDeskSessionOnlyModeEnabled()) {
                    stopInterval();
                    return;
                }
                void enforceSessionOnly();
            }, 300_000);
        };

        const syncInterval = () => {
            if (isClientDeskSessionOnlyModeEnabled()) {
                startInterval();
            } else {
                stopInterval();
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState !== "visible") return;
            syncInterval();
            void enforceSessionOnly();
        };

        const handleStorage = (event: StorageEvent) => {
            if (
                event.key !== null &&
                event.key !== CLIENTDESK_SESSION_ONLY_MODE_KEY
            ) {
                return;
            }
            syncInterval();
        };

        syncInterval();
        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("storage", handleStorage);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("storage", handleStorage);
            stopInterval();
        };
    }, [enforceSessionOnly]);

    return (
        <BookingWriteAccessProvider value={bookingWriteAccess}>
            <DashboardTitleSync />
            <div
                className="admin-dashboard-scope flex overflow-hidden bg-muted/30"
                style={layoutStyle}
            >
                <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
                <div className="flex flex-col flex-1 w-full overflow-hidden">
                    <Topbar onMenuClick={() => setIsSidebarOpen(true)} />
                    <main className="admin-dashboard-content flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                        {children}
                    </main>
                </div>
                <OnboardingTour />
            </div>
        </BookingWriteAccessProvider>
    );
}
