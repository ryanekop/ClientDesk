"use client";

import * as React from "react";
import {
    Area, AreaChart, Bar, BarChart,
    ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { createClient } from "@/utils/supabase/client";

type DailyPoint = { name: string; dateLabel: string; revenue: number };
type MonthlyPoint = { name: string; revenue: number };

export function DashboardCharts() {
    const [dailyData, setDailyData] = React.useState<DailyPoint[]>([]);
    const [monthlyData, setMonthlyData] = React.useState<MonthlyPoint[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        async function load() {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { setLoading(false); return; }

            const now = new Date();

            // ─── 30-day daily income ─────────────────
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const { data: recentBookings } = await supabase
                .from("bookings")
                .select("total_price, dp_paid, created_at, is_fully_paid")
                .eq("user_id", user.id)
                .gte("created_at", thirtyDaysAgo.toISOString())
                .order("created_at", { ascending: true });

            // Use local date keys to avoid UTC offset issues
            const toLocalKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

            // Initialize all 30 days
            const revenueByDate: Record<string, number> = {};
            for (let i = 29; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                revenueByDate[toLocalKey(d)] = 0;
            }

            // Sum per-day income (non-cumulative)
            (recentBookings || []).forEach(b => {
                const dateKey = toLocalKey(new Date(b.created_at));
                const amount = b.is_fully_paid ? (b.total_price || 0) : (b.dp_paid || 0);
                if (revenueByDate[dateKey] !== undefined) {
                    revenueByDate[dateKey] += amount;
                }
            });

            const entries = Object.entries(revenueByDate);
            const dailyPts: DailyPoint[] = entries.map(([date], idx) => {
                const d = new Date(date);
                const fullLabel = d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
                return {
                    name: idx % 5 === 0 || idx === entries.length - 1 ? fullLabel : "",
                    dateLabel: fullLabel,
                    revenue: revenueByDate[date],
                };
            });
            setDailyData(dailyPts);

            // ─── 12-month column chart ───────────────
            const yearAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
            const { data: yearBookings } = await supabase
                .from("bookings")
                .select("total_price, dp_paid, created_at, is_fully_paid")
                .eq("user_id", user.id)
                .gte("created_at", yearAgo.toISOString())
                .order("created_at", { ascending: true });

            const revenueByMonth: Record<string, number> = {};
            for (let i = 11; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                revenueByMonth[key] = 0;
            }

            (yearBookings || []).forEach(b => {
                const d = new Date(b.created_at);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                const amount = b.is_fully_paid ? (b.total_price || 0) : (b.dp_paid || 0);
                if (revenueByMonth[key] !== undefined) {
                    revenueByMonth[key] += amount;
                }
            });

            const monthlyPts: MonthlyPoint[] = Object.entries(revenueByMonth).map(([key, val]) => {
                const [y, m] = key.split("-");
                const d = new Date(Number(y), Number(m) - 1, 1);
                return {
                    name: d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" }),
                    revenue: val,
                };
            });
            setMonthlyData(monthlyPts);

            setLoading(false);
        }
        load();
    }, []);

    if (loading) {
        return (
            <div className="h-[250px] w-full mt-4 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
            </div>
        );
    }

    const formatCurrency = (n: number) =>
        new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

    const formatShort = (n: number) => {
        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`;
        if (n >= 1_000) return `${(n / 1_000).toFixed(0)}rb`;
        return String(n);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
            {/* 30-day daily trend */}
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5">
                <h3 className="font-semibold text-sm mb-3">Pemasukan per Hari</h3>
                <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} tickFormatter={formatShort} width={48} />
                            <Tooltip
                                content={({ active, payload }) => {
                                    if (!active || !payload?.length) return null;
                                    const p = payload[0].payload as DailyPoint;
                                    return (
                                        <div style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
                                            <div style={{ fontWeight: 600, marginBottom: 2 }}>{p.dateLabel}</div>
                                            <div style={{ color: 'var(--foreground)' }}>Pemasukan: {formatCurrency(p.revenue)}</div>
                                        </div>
                                    );
                                }}
                            />
                            <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" dot={false} activeDot={{ r: 4, fill: '#8b5cf6' }} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 12-month column chart */}
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5">
                <h3 className="font-semibold text-sm mb-3">Pemasukan per Bulan (1 Tahun)</h3>
                <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} dy={5} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} tickFormatter={formatShort} width={48} />
                            <Tooltip
                                formatter={(value: any) => [formatCurrency(Number(value)), "Pemasukan"]}
                                contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '13px' }}
                                itemStyle={{ color: 'var(--foreground)' }}
                            />
                            <Bar dataKey="revenue" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
