"use client";

import * as React from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { createClient } from "@/utils/supabase/client";

type ChartPoint = { name: string; revenue: number };

export function DashboardCharts() {
    const [data, setData] = React.useState<ChartPoint[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        async function load() {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { setLoading(false); return; }

            // Get all paid bookings from last 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const { data: bookings } = await supabase
                .from("bookings")
                .select("total_price, dp_paid, created_at, is_fully_paid")
                .eq("user_id", user.id)
                .gte("created_at", thirtyDaysAgo.toISOString())
                .order("created_at", { ascending: true });

            if (!bookings || bookings.length === 0) {
                // Generate empty chart for last 7 days
                const points: ChartPoint[] = [];
                for (let i = 6; i >= 0; i--) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    points.push({
                        name: d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
                        revenue: 0,
                    });
                }
                setData(points);
                setLoading(false);
                return;
            }

            // Group revenue by date
            const revenueByDate: Record<string, number> = {};

            // Initialize all 30 days
            for (let i = 29; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const key = d.toISOString().split("T")[0];
                revenueByDate[key] = 0;
            }

            bookings.forEach(b => {
                const dateKey = new Date(b.created_at).toISOString().split("T")[0];
                const amount = b.is_fully_paid ? (b.total_price || 0) : (b.dp_paid || 0);
                if (revenueByDate[dateKey] !== undefined) {
                    revenueByDate[dateKey] += amount;
                }
            });

            // Convert to cumulative chart points, showing every 5th day label
            const entries = Object.entries(revenueByDate);
            let cumulative = 0;
            const points: ChartPoint[] = entries.map(([date], idx) => {
                cumulative += revenueByDate[date];
                const d = new Date(date);
                return {
                    name: idx % 5 === 0 || idx === entries.length - 1
                        ? d.toLocaleDateString("id-ID", { day: "numeric", month: "short" })
                        : "",
                    revenue: cumulative,
                };
            });

            setData(points);
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

    return (
        <div className="h-[250px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} dy={10} />
                    <Tooltip
                        formatter={(value: any) => [formatCurrency(Number(value)), "Pemasukan"]}
                        contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '13px' }}
                        itemStyle={{ color: 'var(--foreground)' }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
