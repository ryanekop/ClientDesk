"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { useTranslations } from "next-intl";
import { useMoneyVisibility } from "@/hooks/use-money-visibility";

export type DailyPoint = { name: string; dateLabel: string; revenue: number };
export type MonthlyPoint = { name: string; revenue: number };

interface DashboardChartsProps {
  dailyData: DailyPoint[];
  monthlyData: MonthlyPoint[];
}

export function DashboardCharts({
  dailyData,
  monthlyData,
}: DashboardChartsProps) {
  const t = useTranslations("Dashboard");
  const { isMoneyVisible } = useMoneyVisibility();

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(n);

  const formatShort = (n: number) => {
    if (!isMoneyVisible) return "•••";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}${t("jt")}`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}${t("rb")}`;
    return String(n);
  };

  const maskedCurrency = "Rp •••••••";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
      {/* 30-day daily trend */}
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5">
        <h3 className="font-semibold text-sm mb-3">{t("pemasukan30")}</h3>
        <div className="h-[220px] min-h-[220px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart
              data={dailyData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11 }}
                dy={10}
                interval={6}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10 }}
                tickFormatter={formatShort}
                width={48}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as DailyPoint;
                  return (
                    <div
                      style={{
                        backgroundColor: "var(--background)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        padding: "8px 12px",
                        fontSize: 13,
                      }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>
                        {p.dateLabel}
                      </div>
                      <div style={{ color: "var(--foreground)" }}>
                        {t("pemasukan")}:{" "}
                        {isMoneyVisible
                          ? formatCurrency(p.revenue)
                          : maskedCurrency}
                      </div>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#8b5cf6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorRevenue)"
                dot={false}
                activeDot={{ r: 4, fill: "#8b5cf6" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 12-month column chart */}
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5">
        <h3 className="font-semibold text-sm mb-3">{t("pemasukanBulanan")}</h3>
        <div className="h-[220px] min-h-[220px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart
              data={monthlyData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10 }}
                dy={5}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10 }}
                tickFormatter={formatShort}
                width={48}
              />
              <Tooltip
                formatter={(value: unknown) => [
                  isMoneyVisible
                    ? formatCurrency(Number(value ?? 0))
                    : maskedCurrency,
                  t("pemasukan"),
                ]}
                contentStyle={{
                  backgroundColor: "var(--background)",
                  borderColor: "var(--border)",
                  borderRadius: "8px",
                  fontSize: "13px",
                }}
                itemStyle={{ color: "var(--foreground)" }}
              />
              <Bar dataKey="revenue" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
