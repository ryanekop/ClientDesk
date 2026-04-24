import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { getBookingWriteAccessForUser } from "@/lib/booking-write-access.server";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { normalizeAuthLocale } from "@/lib/auth/public-origin";
import { headers } from "next/headers";

export default async function Layout({
    children,
    params,
}: {
    children: React.ReactNode
    params: Promise<{ locale: string }>
}) {
    const { locale: rawLocale } = await params
    const locale = normalizeAuthLocale(rawLocale)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        const headersList = await headers();
        const currentPath = headersList.get("x-current-path") || `/${locale}/dashboard`;
        redirect(`/${locale}/login?next=${encodeURIComponent(currentPath)}`);
    }

    const bookingWriteAccess = await getBookingWriteAccessForUser(user.id);

    return (
        <DashboardLayout bookingWriteAccess={bookingWriteAccess}>
            {children}
        </DashboardLayout>
    );
}
