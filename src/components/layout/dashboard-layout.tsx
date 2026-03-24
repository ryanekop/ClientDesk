"use client";

import * as React from "react";
import type { BookingWriteAccessState } from "@/lib/booking-write-access";
import { BookingWriteAccessProvider } from "@/lib/booking-write-access-context";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import {
    clearClientDeskSessionOnlyState,
    evaluateClientDeskSessionOnlyState,
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
    const router = useRouter();
    const locale = useLocale();
    const signingOutRef = React.useRef(false);
    const layoutStyle = React.useMemo(
        () =>
            ({
                "--dashboard-topbar-height": "64px",
                height: "calc(100vh - var(--global-announcement-height, 0px))",
            }) as React.CSSProperties,
        [],
    );

    const enforceSessionOnly = React.useCallback(async () => {
        if (signingOutRef.current) return;

        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { shouldSignOut } = evaluateClientDeskSessionOnlyState(user.id);
        if (!shouldSignOut) return;

        signingOutRef.current = true;
        clearClientDeskSessionOnlyState();
        await supabase.auth.signOut();
        router.replace(`/${locale}/login`);
    }, [locale, router]);

    React.useEffect(() => {
        void enforceSessionOnly();

        const interval = window.setInterval(() => {
            void enforceSessionOnly();
        }, 60_000);

        return () => {
            window.clearInterval(interval);
        };
    }, [enforceSessionOnly]);

    return (
        <BookingWriteAccessProvider value={bookingWriteAccess}>
            <div
                className="flex overflow-hidden bg-muted/30"
                style={layoutStyle}
            >
                <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
                <div className="flex flex-col flex-1 w-full overflow-hidden">
                    <Topbar onMenuClick={() => setIsSidebarOpen(true)} />
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                        {children}
                    </main>
                </div>
            </div>
        </BookingWriteAccessProvider>
    );
}
