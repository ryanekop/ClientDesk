import * as React from "react";
import { createClient } from "@/utils/supabase/server";
import { formatSessionDate } from "@/utils/format-date";
import type { UpcomingBooking } from "@/components/dashboard/dashboard-widgets";
import {
  Users,
  CreditCard,
  TrendingUp,
  CalendarDays,
  User,
  Plus,
  Wallet,
  Calendar,
  Camera,
  Clock3,
  ListOrdered,
} from "lucide-react";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { UpcomingBookingCard } from "@/components/dashboard/dashboard-widgets";
import { DashboardChangelogPopup } from "@/components/changelog-modal";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { ChangelogEntry } from "@/lib/changelog";
import { getInitialBookingStatus } from "@/lib/client-status";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [t, locale] = await Promise.all([
    getTranslations("Dashboard"),
    getLocale(),
  ]);

  const now = new Date();
  const startOfMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
  ).toISOString();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).toISOString();
  const todayEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  ).toISOString();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const yearAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, studio_name, custom_client_statuses")
    .eq("id", user!.id)
    .single();
  const initialBookingStatus = getInitialBookingStatus(
    (profile as { custom_client_statuses?: string[] | null } | null)
      ?.custom_client_statuses,
  );

  // Dashboard data + changelog are fetched in parallel to keep the page snappy.
  const [
    { count: totalBookings },
    { data: pendingPayments },
    { data: paidBookings },
    { count: monthlyBookings },
    { count: todaySessions },
    { count: pendingCount },
    { data: recentBookings },
    { data: upcomingBooking },
    { data: dailyRaw },
    { data: yearlyRaw },
    { data: changelogRaw },
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user!.id),
    supabase
      .from("bookings")
      .select("total_price, dp_paid")
      .eq("user_id", user!.id)
      .eq("is_fully_paid", false)
      .neq("status", "Batal"),
    supabase
      .from("bookings")
      .select("total_price, dp_paid")
      .eq("user_id", user!.id),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user!.id)
      .gte("created_at", startOfMonth),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user!.id)
      .gte("session_date", todayStart)
      .lt("session_date", todayEnd),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user!.id)
      .eq("status", initialBookingStatus),
    supabase
      .from("bookings")
      .select(
        "id, client_name, booking_code, session_date, status, total_price, created_at, services(name)",
      )
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("bookings")
      .select(
        "id, client_name, booking_code, session_date, location, status, services(name)",
      )
      .eq("user_id", user!.id)
      .gte("session_date", now.toISOString())
      .neq("status", "Batal")
      .order("session_date", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("bookings")
      .select("total_price, dp_paid, created_at, is_fully_paid")
      .eq("user_id", user!.id)
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: true }),
    supabase
      .from("bookings")
      .select("total_price, dp_paid, created_at, is_fully_paid")
      .eq("user_id", user!.id)
      .gte("created_at", yearAgo.toISOString())
      .order("created_at", { ascending: true }),
    supabase
      .from("changelog")
      .select("id, version, title, description, badge, published_at")
      .order("published_at", { ascending: false })
      .limit(50),
  ]);

  const pendingAmount = (pendingPayments || []).reduce(
    (sum, b) => sum + ((b.total_price || 0) - (b.dp_paid || 0)),
    0,
  );
  const totalRevenue = (paidBookings || []).reduce(
    (sum, b) => sum + (b.dp_paid || 0),
    0,
  );
  const displayName = profile?.full_name || user?.email || "Admin";
  const dateLocale = locale === "en" ? "en-US" : "id-ID";

  // --- Process 30-day daily chart data server-side ---
  const toLocalKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const toLocalLabel = (d: Date) =>
    d.toLocaleDateString(dateLocale, { day: "numeric", month: "short" });

  const revenueByDate: Record<string, number> = {};
  const dateLabelMap: Record<string, string> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = toLocalKey(d);
    revenueByDate[key] = 0;
    dateLabelMap[key] = toLocalLabel(d);
  }
  (dailyRaw || []).forEach((b) => {
    const d = new Date(b.created_at);
    const dateKey = toLocalKey(d);
    const amount = b.is_fully_paid ? b.total_price || 0 : b.dp_paid || 0;
    if (revenueByDate[dateKey] !== undefined) {
      revenueByDate[dateKey] += amount;
    }
  });
  const dailyData = Object.entries(revenueByDate).map(([date, rev]) => ({
    name: dateLabelMap[date],
    dateLabel: dateLabelMap[date],
    revenue: rev,
  }));

  // --- Process 12-month chart data server-side ---
  const revenueByMonth: Record<string, number> = {};
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    revenueByMonth[key] = 0;
  }
  (yearlyRaw || []).forEach((b) => {
    const d = new Date(b.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const amount = b.is_fully_paid ? b.total_price || 0 : b.dp_paid || 0;
    if (revenueByMonth[key] !== undefined) {
      revenueByMonth[key] += amount;
    }
  });
  const monthlyData = Object.entries(revenueByMonth).map(([key, val]) => {
    const [y, m] = key.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return {
      name: d.toLocaleDateString(dateLocale, {
        month: "short",
        year: "2-digit",
      }),
      revenue: val,
    };
  });

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(n);

  const formatDate = (d: string | null) => {
    if (!d) return "-";
    return formatSessionDate(d, { locale: locale === "en" ? "en" : "id", withDay: false, dateOnly: true });
  };

  const statusColors: Record<string, string> = {
    pending:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    dp: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
    terjadwal:
      "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
    selesai:
      "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400",
    edit: "bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400",
    batal: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  };
  const changelogEntries = (changelogRaw || []) as ChangelogEntry[];

  return (
    <div className="space-y-6">
      <DashboardChangelogPopup entries={changelogEntries} locale={locale} />

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          👋 {t("welcome", { name: displayName })}
        </h2>
      </div>

      {/* Row 1: 4 Stats Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
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
        <UpcomingBookingCard
          booking={upcomingBooking as UpcomingBooking | null}
        />
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5 space-y-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {t("ringkasanHariIni")}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border bg-card shadow-sm p-4 hover:shadow-md transition-shadow">
              <div className="flex flex-row items-center justify-between">
                <div className="flex flex-col gap-1">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {t("sesiHariIni")}
                  </h4>
                  <div className="text-xl font-bold text-foreground">
                    {todaySessions || 0}{" "}
                    <span className="text-sm font-medium text-muted-foreground">
                      {t("sesi")}
                    </span>
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-500/10">
                  <Camera className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </div>
            <div className="rounded-xl border bg-card shadow-sm p-4 hover:shadow-md transition-shadow">
              <div className="flex flex-row items-center justify-between">
                <div className="flex flex-col gap-1">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {t("perluKonfirmasi")}
                  </h4>
                  <div className="text-xl font-bold text-foreground">
                    {pendingCount || 0}{" "}
                    <span className="text-sm font-medium text-muted-foreground">
                      Pending
                    </span>
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-500/10">
                  <Clock3 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </div>
          </div>
          {/* Quick Actions */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {t("aksiCepat")}
            </h4>
            <div className="grid grid-cols-4 gap-2">
              <Link
                href="/bookings/new"
                className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-center group"
              >
                <div className="p-2 rounded-lg bg-foreground/5 dark:bg-foreground/10 group-hover:bg-foreground/10 dark:group-hover:bg-foreground/20 transition-colors">
                  <Plus className="w-4 h-4 text-foreground" />
                </div>
                <span className="text-[11px] font-medium">{t("baru")}</span>
              </Link>
              <Link
                href="/bookings"
                className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-center group"
              >
                <div className="p-2 rounded-lg bg-foreground/5 dark:bg-foreground/10 group-hover:bg-foreground/10 dark:group-hover:bg-foreground/20 transition-colors">
                  <ListOrdered className="w-4 h-4 text-foreground" />
                </div>
                <span className="text-[11px] font-medium">
                  {t("daftarBooking")}
                </span>
              </Link>
              <Link
                href="/calendar"
                className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-center group"
              >
                <div className="p-2 rounded-lg bg-foreground/5 dark:bg-foreground/10 group-hover:bg-foreground/10 dark:group-hover:bg-foreground/20 transition-colors">
                  <Calendar className="w-4 h-4 text-foreground" />
                </div>
                <span className="text-[11px] font-medium">{t("kalender")}</span>
              </Link>
              <Link
                href="/finance"
                className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-center group"
              >
                <div className="p-2 rounded-lg bg-foreground/5 dark:bg-foreground/10 group-hover:bg-foreground/10 dark:group-hover:bg-foreground/20 transition-colors">
                  <Wallet className="w-4 h-4 text-foreground" />
                </div>
                <span className="text-[11px] font-medium">{t("keuangan")}</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Grafik — data sudah diproses server-side, tidak perlu loading state */}
      <DashboardCharts dailyData={dailyData} monthlyData={monthlyData} />

      {/* Row 4: Booking Terbaru (Full Width Table) */}
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h3 className="font-semibold leading-none tracking-tight">
              {t("bookingTerbaru")}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {t("transaksiTerakhir")}
            </p>
          </div>
          <Link
            href="/bookings"
            className="text-xs text-primary hover:underline font-medium"
          >
            {t("lihatSemua")}
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="text-left font-medium px-6 py-3">
                  {t("klien")}
                </th>
                <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">
                  {t("paket")}
                </th>
                <th className="text-left font-medium px-4 py-3 hidden md:table-cell">
                  {t("tanggalBooking")}
                </th>
                <th className="text-left font-medium px-4 py-3 hidden md:table-cell">
                  {t("jadwal")}
                </th>
                <th className="text-left font-medium px-4 py-3">
                  {t("status")}
                </th>
                <th className="text-right font-medium px-6 py-3 hidden sm:table-cell">
                  {t("total")}
                </th>
              </tr>
            </thead>
            <tbody>
              {!recentBookings || recentBookings.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-8 text-sm text-muted-foreground"
                  >
                    {t("belumAdaBooking")}
                  </td>
                </tr>
              ) : (
                recentBookings.map((b) => (
                  <tr
                    key={b.id}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-6 py-3">
                      <Link
                        href={`/bookings/${b.id}`}
                        className="flex items-center gap-3 hover:underline"
                      >
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-tight">
                            {b.client_name}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {b.booking_code}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm hidden sm:table-cell">
                      {(Array.isArray(b.services)
                        ? (b.services[0] as { name: string } | undefined)?.name
                        : (b.services as { name: string } | null)?.name) || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                      {formatDate(
                        (b as typeof b & { created_at: string }).created_at,
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                      {formatDate(b.session_date)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                          statusColors[b.status?.toLowerCase()] ||
                          statusColors.pending
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm font-medium text-right hidden sm:table-cell">
                      {formatCurrency(b.total_price)}
                    </td>
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

function StatsCard({
  title,
  value,
  subtitle,
  icon,
  colorVariant,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  colorVariant: "blue" | "green" | "red" | "orange";
}) {
  const colorStyles = {
    blue: "bg-[#e8f0fe] text-[#1a73e8] dark:bg-blue-500/10 dark:text-blue-400",
    green:
      "bg-[#e6f4ea] text-[#1e8e3e] dark:bg-green-500/10 dark:text-green-400",
    red: "bg-[#fce8e6] text-[#d93025] dark:bg-red-500/10 dark:text-red-400",
    orange:
      "bg-[#fef7e0] text-[#f29900] dark:bg-orange-500/10 dark:text-orange-400",
  };

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-col gap-1">
          <h3 className="tracking-wide text-xs font-semibold text-muted-foreground uppercase">
            {title}
          </h3>
          <div className="text-xl font-bold text-foreground">
            {value}{" "}
            {subtitle && (
              <span className="text-sm font-medium text-muted-foreground">
                {subtitle}
              </span>
            )}
          </div>
        </div>
        <div
          className={`p-2 rounded-lg flex items-center justify-center ${colorStyles[colorVariant]}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
