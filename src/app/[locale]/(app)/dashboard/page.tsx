import * as React from "react";
import { createClient } from "@/utils/supabase/server";
import { Users, CreditCard, TrendingUp, CalendarDays, User, Plus, Wallet, Calendar, Camera, Clock3, ListOrdered } from "lucide-react";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { UpcomingBookingCard } from "@/components/dashboard/dashboard-widgets";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";

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

    // Today's sessions
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
    const { count: todaySessions } = await supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .gte("session_date", todayStart)
        .lt("session_date", todayEnd);

    // Pending confirmation count
    const { count: pendingCount } = await supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("status", "Pending");

    // Recent bookings (5)
    const { data: recentBookings } = await supabase
        .from("bookings")
        .select("id, client_name, booking_code, session_date, status, total_price, created_at, services(name)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(5);

    const displayName = profile?.full_name || user?.email || "Admin";

    const formatCurrency = (n: number) =>
        new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

    const formatDate = (d: string | null) => {
        if (!d) return "-";
        return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
    };

    const statusColors: Record<string, string> = {
        pending: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
        dp: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
        terjadwal: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
        selesai: "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400",
        edit: "bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400",
        batal: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold tracking-tight">👋 {t("welcome", { name: displayName })}</h2>
            </div>

            {/* Row 1: 4 Stats Cards */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <StatsCard
                    title={t("totalBooking")}
                    value={`${totalBookings || 0}`}
                    subtitle="Booking"
                    icon={<Users className="w-5 h-5" />}
                    colorVariant="blue"
                />
                <StatsCard
                    title={t("bookingBulanIni")}
                    value={`${monthlyBookings || 0}`}
                    subtitle="Booking"
                    icon={<CalendarDays className="w-5 h-5" />}
                    colorVariant="orange"
                />
                <StatsCard
                    title={t("totalPemasukan")}
                    value={formatCurrency(totalRevenue)}
                    icon={<TrendingUp className="w-5 h-5" />}
                    colorVariant="green"
                />
                <StatsCard
                    title={t("menungguPembayaran")}
                    value={formatCurrency(pendingAmount)}
                    icon={<CreditCard className="w-5 h-5" />}
                    colorVariant="red"
                />
            </div>

            {/* Row 2: Booking Terdekat + Ringkasan Hari Ini */}
            <div className="grid gap-4 sm:grid-cols-2">
                <UpcomingBookingCard />
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5 space-y-4">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ringkasan Hari Ini</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border bg-card shadow-sm p-4 hover:shadow-md transition-shadow">
                            <div className="flex flex-row items-center justify-between">
                                <div className="flex flex-col gap-1">
                                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sesi Hari Ini</h4>
                                    <div className="text-xl font-bold text-foreground">{todaySessions || 0} <span className="text-sm font-medium text-muted-foreground">Sesi</span></div>
                                </div>
                                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-500/10">
                                    <Camera className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                            </div>
                        </div>
                        <div className="rounded-xl border bg-card shadow-sm p-4 hover:shadow-md transition-shadow">
                            <div className="flex flex-row items-center justify-between">
                                <div className="flex flex-col gap-1">
                                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Perlu Konfirmasi</h4>
                                    <div className="text-xl font-bold text-foreground">{pendingCount || 0} <span className="text-sm font-medium text-muted-foreground">Pending</span></div>
                                </div>
                                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-500/10">
                                    <Clock3 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Quick Actions */}
                    <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Aksi Cepat</h4>
                        <div className="grid grid-cols-4 gap-2">
                            <Link href="/bookings/new" className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-center group">
                                <div className="p-2 rounded-lg bg-foreground/5 dark:bg-foreground/10 group-hover:bg-foreground/10 dark:group-hover:bg-foreground/20 transition-colors">
                                    <Plus className="w-4 h-4 text-foreground" />
                                </div>
                                <span className="text-[11px] font-medium">Baru</span>
                            </Link>
                            <Link href="/bookings" className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-center group">
                                <div className="p-2 rounded-lg bg-foreground/5 dark:bg-foreground/10 group-hover:bg-foreground/10 dark:group-hover:bg-foreground/20 transition-colors">
                                    <ListOrdered className="w-4 h-4 text-foreground" />
                                </div>
                                <span className="text-[11px] font-medium">Daftar Booking</span>
                            </Link>
                            <Link href="/calendar" className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-center group">
                                <div className="p-2 rounded-lg bg-foreground/5 dark:bg-foreground/10 group-hover:bg-foreground/10 dark:group-hover:bg-foreground/20 transition-colors">
                                    <Calendar className="w-4 h-4 text-foreground" />
                                </div>
                                <span className="text-[11px] font-medium">Kalender</span>
                            </Link>
                            <Link href="/finance" className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-center group">
                                <div className="p-2 rounded-lg bg-foreground/5 dark:bg-foreground/10 group-hover:bg-foreground/10 dark:group-hover:bg-foreground/20 transition-colors">
                                    <Wallet className="w-4 h-4 text-foreground" />
                                </div>
                                <span className="text-[11px] font-medium">Keuangan</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Row 3: Grafik (no card wrapper — charts have their own cards) */}
            <DashboardCharts />

            {/* Row 4: Booking Terbaru (Full Width Table) */}
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                <div className="px-6 py-4 border-b flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold leading-none tracking-tight">{t("bookingTerbaru")}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{t("transaksiTerakhir")}</p>
                    </div>
                    <Link href="/bookings" className="text-xs text-primary hover:underline font-medium">
                        Lihat Semua →
                    </Link>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b text-xs text-muted-foreground">
                                <th className="text-left font-medium px-6 py-3">Klien</th>
                                <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">Paket</th>
                                <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Jadwal</th>
                                <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Tanggal Booking</th>
                                <th className="text-left font-medium px-4 py-3">Status</th>
                                <th className="text-right font-medium px-6 py-3 hidden sm:table-cell">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(!recentBookings || recentBookings.length === 0) ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-sm text-muted-foreground">{t("belumAdaBooking")}</td>
                                </tr>
                            ) : (
                                recentBookings.map((b) => (
                                    <tr key={b.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                        <td className="px-6 py-3">
                                            <Link href={`/bookings/${b.id}`} className="flex items-center gap-3 hover:underline">
                                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium leading-tight">{b.client_name}</p>
                                                    <p className="text-[11px] text-muted-foreground">{b.booking_code}</p>
                                                </div>
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3 text-sm hidden sm:table-cell">{(b.services as any)?.name || "-"}</td>
                                        <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">{formatDate(b.session_date)}</td>
                                        <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">{formatDate((b as any).created_at)}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusColors[b.status?.toLowerCase()] || statusColors.pending}`}>
                                                {b.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-sm font-medium text-right hidden sm:table-cell">{formatCurrency(b.total_price)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function StatsCard({ title, value, subtitle, icon, colorVariant }: { title: string; value: string; subtitle?: string; icon: React.ReactNode; colorVariant: "blue" | "green" | "red" | "orange" }) {
    const colorStyles = {
        blue: "bg-[#e8f0fe] text-[#1a73e8] dark:bg-blue-500/10 dark:text-blue-400",
        green: "bg-[#e6f4ea] text-[#1e8e3e] dark:bg-green-500/10 dark:text-green-400",
        red: "bg-[#fce8e6] text-[#d93025] dark:bg-red-500/10 dark:text-red-400",
        orange: "bg-[#fef7e0] text-[#f29900] dark:bg-orange-500/10 dark:text-orange-400",
    };

    return (
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex flex-row items-center justify-between">
                <div className="flex flex-col gap-1">
                    <h3 className="tracking-wide text-xs font-semibold text-muted-foreground uppercase">{title}</h3>
                    <div className="text-xl font-bold text-foreground">
                        {value} {subtitle && <span className="text-sm font-medium text-muted-foreground">{subtitle}</span>}
                    </div>
                </div>
                <div className={`p-2 rounded-lg flex items-center justify-center ${colorStyles[colorVariant]}`}>
                    {icon}
                </div>
            </div>
        </div>
    );
}
