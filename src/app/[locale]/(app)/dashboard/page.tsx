import * as React from "react";
import { createClient } from "@/utils/supabase/server";
import { Users, CreditCard, TrendingUp, CalendarDays, User } from "lucide-react";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { RealtimeClock, UpcomingBookingCard } from "@/components/dashboard/dashboard-widgets";
import { getTranslations } from "next-intl/server";

export default async function DashboardPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const t = await getTranslations("Dashboard");

    // Fetch profile
    const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, studio_name")
        .eq("id", user!.id)
        .single();

    // Fetch stats
    const { count: totalBookings } = await supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id);

    const { data: pendingPayments } = await supabase
        .from("bookings")
        .select("total_price, dp_paid")
        .eq("user_id", user!.id)
        .eq("is_fully_paid", false)
        .neq("status", "Batal");

    const pendingAmount = (pendingPayments || []).reduce((sum, b) => sum + ((b.total_price || 0) - (b.dp_paid || 0)), 0);

    const { data: paidBookings } = await supabase
        .from("bookings")
        .select("total_price")
        .eq("user_id", user!.id)
        .eq("is_fully_paid", true);

    const totalRevenue = (paidBookings || []).reduce((sum, b) => sum + (b.total_price || 0), 0);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { count: monthlyBookings } = await supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .gte("created_at", startOfMonth);

    // Recent bookings
    const { data: recentBookings } = await supabase
        .from("bookings")
        .select("id, client_name, booking_code, session_date, services(name)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(5);

    const displayName = profile?.full_name || user?.email || "Admin";

    const formatCurrency = (n: number) =>
        new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

    const formatDate = (d: string | null) => {
        if (!d) return "-";
        return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">{t("welcome", { name: displayName })}</h2>
                <p className="text-muted-foreground">{t("subtitle")}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <RealtimeClock />
                <UpcomingBookingCard />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatsCard
                    title={t("totalBooking")}
                    value={`${totalBookings || 0} Booking`}
                    icon={<Users className="w-5 h-5" />}
                    colorVariant="blue"
                />
                <StatsCard
                    title={t("menungguPembayaran")}
                    value={formatCurrency(pendingAmount)}
                    icon={<CreditCard className="w-5 h-5" />}
                    colorVariant="red"
                />
                <StatsCard
                    title={t("totalPemasukan")}
                    value={formatCurrency(totalRevenue)}
                    icon={<TrendingUp className="w-5 h-5" />}
                    colorVariant="green"
                />
                <StatsCard
                    title={t("bookingBulanIni")}
                    value={`${monthlyBookings || 0} Booking`}
                    icon={<CalendarDays className="w-5 h-5" />}
                    colorVariant="orange"
                />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <div className="col-span-4 rounded-xl border bg-card text-card-foreground shadow-sm p-6">
                    <div className="flex flex-col space-y-1.5 mb-4">
                        <h3 className="font-semibold leading-none tracking-tight">{t("trendPemasukan")}</h3>
                    </div>
                    <DashboardCharts />
                </div>
                <div className="col-span-3 rounded-xl border bg-card text-card-foreground shadow-sm p-6">
                    <div className="flex flex-col space-y-1.5 mb-4">
                        <h3 className="font-semibold leading-none tracking-tight">{t("bookingTerbaru")}</h3>
                        <p className="text-sm text-muted-foreground">{t("transaksiTerakhir")}</p>
                    </div>
                    <div className="space-y-6">
                        {(!recentBookings || recentBookings.length === 0) ? (
                            <p className="text-sm text-muted-foreground text-center py-8">{t("belumAdaBooking")}</p>
                        ) : (
                            recentBookings.map((booking) => (
                                <div key={booking.id} className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                                            <User className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium leading-none mb-1">{booking.client_name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {(booking.services as any)?.name || booking.booking_code}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="font-medium text-sm">{formatDate(booking.session_date)}</div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatsCard({ title, value, icon, colorVariant }: { title: string; value: string; icon: React.ReactNode; colorVariant: "blue" | "green" | "red" | "orange" }) {
    const colorStyles = {
        blue: "bg-[#e8f0fe] text-[#1a73e8] dark:bg-blue-500/10 dark:text-blue-400",
        green: "bg-[#e6f4ea] text-[#1e8e3e] dark:bg-green-500/10 dark:text-green-400",
        red: "bg-[#fce8e6] text-[#d93025] dark:bg-red-500/10 dark:text-red-400",
        orange: "bg-[#fef7e0] text-[#f29900] dark:bg-orange-500/10 dark:text-orange-400",
    };

    return (
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex flex-row items-center justify-between">
                <div className="flex flex-col gap-1.5">
                    <h3 className="tracking-wide text-xs font-semibold text-muted-foreground uppercase">{title}</h3>
                    <div className="text-xl font-bold text-foreground">{value}</div>
                </div>
                <div className={`p-2 rounded-lg flex items-center justify-center ${colorStyles[colorVariant]}`}>
                    {icon}
                </div>
            </div>
        </div>
    );
}
