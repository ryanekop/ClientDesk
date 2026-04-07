"use client";

import * as React from "react";
import {
  Wallet,
  Receipt,
  Landmark,
  TrendingUp,
  Clock3,
  RefreshCcw,
  Package2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLocale, useTranslations } from "next-intl";

import { PageHeader } from "@/components/ui/page-header";
import { MoneyVisibilityToggle } from "@/components/ui/money-visibility";
import {
  FilterSingleSelect,
  type FilterSingleSelectOption,
} from "@/components/ui/filter-single-select";
import { Button } from "@/components/ui/button";
import { useMoneyVisibility } from "@/hooks/use-money-visibility";

type DashboardSummary = {
  grossRevenue: number;
  operationalCosts: number;
  netRevenue: number;
  verifiedDp: number;
  outstandingBalance: number;
  bookingCount: number;
};

type SourceBreakdownRow = {
  sourceKey: string;
  label: string;
  amount: number;
};

type MonthlyChartRow = {
  periodKey: string;
  grossRevenue: number;
  verifiedDp: number;
  operationalCosts: number;
  netRevenue: number;
};

type TopPackageRow = {
  packageName: string;
  bookingCount: number;
  grossRevenue: number;
  netRevenue: number;
};

type FinanceDashboardPayload = {
  selectedPeriod: string;
  currentPeriod: string;
  availablePeriods: string[];
  summary: DashboardSummary;
  sourceBreakdown: SourceBreakdownRow[];
  monthlyChart: MonthlyChartRow[];
  topPackages: TopPackageRow[];
};

function isFinanceDashboardPayload(value: unknown): value is FinanceDashboardPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<FinanceDashboardPayload>;
  return (
    typeof candidate.selectedPeriod === "string" &&
    typeof candidate.currentPeriod === "string" &&
    Array.isArray(candidate.availablePeriods) &&
    Array.isArray(candidate.sourceBreakdown) &&
    Array.isArray(candidate.monthlyChart) &&
    Array.isArray(candidate.topPackages)
  );
}

const EMPTY_SUMMARY: DashboardSummary = {
  grossRevenue: 0,
  operationalCosts: 0,
  netRevenue: 0,
  verifiedDp: 0,
  outstandingBalance: 0,
  bookingCount: 0,
};

const EMPTY_PAYLOAD: FinanceDashboardPayload = {
  selectedPeriod: "all",
  currentPeriod: "",
  availablePeriods: [],
  summary: EMPTY_SUMMARY,
  sourceBreakdown: [],
  monthlyChart: [],
  topPackages: [],
};

function formatMonthLabel(periodKey: string, locale: string) {
  const [year, month] = periodKey.split("-");
  if (!year || !month) return periodKey;

  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) return periodKey;

  return date.toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
    month: "long",
    year: "numeric",
  });
}

function SummaryCard({
  title,
  hint,
  amount,
  icon,
  tone,
  isMoneyVisible,
}: {
  title: string;
  hint: string;
  amount: number;
  icon: React.ReactNode;
  tone: string;
  isMoneyVisible: boolean;
}) {
  const formattedAmount = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount || 0);

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <div className={`rounded-xl p-2 ${tone}`}>{icon}</div>
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </span>
      </div>
      <div className="text-2xl font-bold tracking-tight">
        {isMoneyVisible ? formattedAmount : "Rp •••••••"}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

export default function FinanceDashboardPage() {
  const t = useTranslations("FinanceDashboard");
  const locale = useLocale();
  const { isMoneyVisible } = useMoneyVisibility();
  const [timeZone, setTimeZone] = React.useState("UTC");
  const [selectedPeriod, setSelectedPeriod] = React.useState("all");
  const [payload, setPayload] = React.useState<FinanceDashboardPayload>(EMPTY_PAYLOAD);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    try {
      const resolvedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (resolvedTimeZone) {
        setTimeZone(resolvedTimeZone);
      }
    } catch {
      setTimeZone("UTC");
    }
  }, []);

  const loadDashboard = React.useCallback(
    async (period: string, options?: { preserveData?: boolean }) => {
      if (options?.preserveData) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      try {
        const params = new URLSearchParams({
          period,
          timeZone,
        });
        const response = await fetch(`/api/internal/finance-dashboard?${params.toString()}`, {
          cache: "no-store",
        });
        const result = (await response.json().catch(() => null)) as unknown;
        const errorMessage =
          result && typeof result === "object" && "error" in result
            ? String((result as { error?: unknown }).error || "")
            : "";

        if (!response.ok || !isFinanceDashboardPayload(result)) {
          throw new Error(errorMessage || t("failedLoad"));
        }

        setPayload({
          selectedPeriod:
            typeof result.selectedPeriod === "string" ? result.selectedPeriod : period,
          currentPeriod:
            typeof result.currentPeriod === "string" ? result.currentPeriod : "",
          availablePeriods: Array.isArray(result.availablePeriods)
            ? result.availablePeriods.filter((item): item is string => typeof item === "string")
            : [],
          summary: result.summary || EMPTY_SUMMARY,
          sourceBreakdown: Array.isArray(result.sourceBreakdown) ? result.sourceBreakdown : [],
          monthlyChart: Array.isArray(result.monthlyChart) ? result.monthlyChart : [],
          topPackages: Array.isArray(result.topPackages) ? result.topPackages : [],
        });
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : t("failedLoad"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [t, timeZone],
  );

  React.useEffect(() => {
    void loadDashboard(selectedPeriod);
  }, [loadDashboard, selectedPeriod]);

  const periodOptions = React.useMemo<FilterSingleSelectOption[]>(() => {
    const values = new Set<string>(["all", ...payload.availablePeriods]);
    return Array.from(values).map((value) => ({
      value,
      label: value === "all" ? t("allPeriods") : formatMonthLabel(value, locale),
    }));
  }, [locale, payload.availablePeriods, t]);

  const visibleSourceBreakdown = React.useMemo(() => {
    return payload.sourceBreakdown
      .map((item) => {
        if (item.sourceKey === "unknown") {
          return { ...item, label: t("sourceUnknown") };
        }
        if (item.sourceKey === "cash") {
          return { ...item, label: t("sourceCash") };
        }
        if (item.sourceKey === "qris") {
          return { ...item, label: t("sourceQris") };
        }
        return item;
      })
      .filter((item) => item.amount !== 0);
  }, [payload.sourceBreakdown, t]);

  const chartRows = React.useMemo(
    () =>
      payload.monthlyChart.map((item) => ({
        ...item,
        label: formatMonthLabel(item.periodKey, locale),
        shortLabel: formatMonthLabel(item.periodKey, locale).slice(0, 3),
      })),
    [locale, payload.monthlyChart],
  );

  const formatCurrency = React.useCallback(
    (amount: number) =>
      new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
      }).format(amount || 0),
    [],
  );

  const formatCompactAmount = React.useCallback(
    (amount: number) => {
      if (!isMoneyVisible) return "•••";
      if (Math.abs(amount) >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)} jt`;
      if (Math.abs(amount) >= 1_000) return `${(amount / 1_000).toFixed(0)} rb`;
      return String(Math.round(amount));
    },
    [isMoneyVisible],
  );

  const activePeriodLabel =
    selectedPeriod === "all" ? t("allPeriods") : formatMonthLabel(selectedPeriod, locale);

  return (
    <div className="space-y-6">
      <PageHeader
        actions={(
          <>
            <FilterSingleSelect
              value={selectedPeriod}
              onChange={setSelectedPeriod}
              options={periodOptions}
              placeholder={t("allPeriods")}
              className="w-full md:w-[240px]"
              mobileTitle={t("periodLabel")}
            />
            <MoneyVisibilityToggle className="w-full md:w-auto" />
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 md:w-auto"
              onClick={() => {
                void loadDashboard(selectedPeriod, { preserveData: true });
              }}
              disabled={loading || refreshing}
            >
              <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              {t("retry")}
            </Button>
          </>
        )}
      >
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
      </PageHeader>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-4 text-sm text-red-700 shadow-sm dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>{error}</p>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                void loadDashboard(selectedPeriod, { preserveData: true });
              }}
              disabled={refreshing}
            >
              {t("retry")}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
        <span className="font-medium text-foreground">{t("periodLabel")}:</span>{" "}
        {activePeriodLabel}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          title={t("grossRevenue")}
          hint={t("grossRevenueHint")}
          amount={payload.summary.grossRevenue}
          isMoneyVisible={isMoneyVisible}
          tone="bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400"
          icon={<Wallet className="h-5 w-5" />}
        />
        <SummaryCard
          title={t("operationalCosts")}
          hint={t("operationalCostsHint")}
          amount={payload.summary.operationalCosts}
          isMoneyVisible={isMoneyVisible}
          tone="bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400"
          icon={<Receipt className="h-5 w-5" />}
        />
        <SummaryCard
          title={t("netRevenue")}
          hint={t("netRevenueHint")}
          amount={payload.summary.netRevenue}
          isMoneyVisible={isMoneyVisible}
          tone="bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400"
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <SummaryCard
          title={t("verifiedDp")}
          hint={t("verifiedDpHint")}
          amount={payload.summary.verifiedDp}
          isMoneyVisible={isMoneyVisible}
          tone="bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
          icon={<Landmark className="h-5 w-5" />}
        />
        <SummaryCard
          title={t("outstandingBalance")}
          hint={t("outstandingBalanceHint")}
          amount={payload.summary.outstandingBalance}
          isMoneyVisible={isMoneyVisible}
          tone="bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-300"
          icon={<Clock3 className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="font-semibold">{t("monthlyChartTitle")}</h3>
            <p className="text-sm text-muted-foreground">{t("monthlyChartSubtitle")}</p>
          </div>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="shortLabel" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11 }}
                  width={52}
                  tickFormatter={formatCompactAmount}
                />
                <Tooltip
                  content={({ active, payload: tooltipPayload }) => {
                    if (!active || !tooltipPayload?.length) return null;
                    const item = tooltipPayload[0]?.payload as
                      | (MonthlyChartRow & { label: string })
                      | undefined;
                    if (!item) return null;

                    return (
                      <div className="rounded-lg border bg-background px-3 py-2 text-sm shadow-sm">
                        <p className="mb-2 font-semibold">{item.label}</p>
                        <p>{t("chartGrossRevenue")}: {isMoneyVisible ? formatCurrency(item.grossRevenue) : "Rp •••••••"}</p>
                        <p>{t("chartOperationalCosts")}: {isMoneyVisible ? formatCurrency(item.operationalCosts) : "Rp •••••••"}</p>
                        <p>{t("chartNetRevenue")}: {isMoneyVisible ? formatCurrency(item.netRevenue) : "Rp •••••••"}</p>
                      </div>
                    );
                  }}
                />
                <Legend />
                <Bar dataKey="netRevenue" name={t("chartNetRevenue")} fill="#0891b2" radius={[6, 6, 0, 0]} />
                <Bar dataKey="operationalCosts" name={t("chartOperationalCosts")} fill="#fb7185" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-4">
              <h3 className="font-semibold">{t("sourceBreakdown")}</h3>
              <p className="text-sm text-muted-foreground">{activePeriodLabel}</p>
            </div>
            {visibleSourceBreakdown.length > 0 ? (
              <div className="space-y-3">
                {visibleSourceBreakdown.map((item) => (
                  <div key={item.sourceKey} className="rounded-xl border bg-muted/20 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{item.label}</span>
                      <span className="text-sm font-semibold">
                        {isMoneyVisible ? formatCurrency(item.amount) : "Rp •••••••"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed bg-muted/10 px-4 py-5 text-sm text-muted-foreground">
                {t("sourceEmpty")}
              </div>
            )}
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-xl bg-amber-100 p-2 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                <Package2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">{t("topPackagesTitle")}</h3>
                <p className="text-sm text-muted-foreground">{t("topPackagesSubtitle")}</p>
              </div>
            </div>

            {payload.topPackages.length > 0 ? (
              <div className="space-y-3">
                {payload.topPackages.map((item, index) => (
                  <div key={`${item.packageName}-${index}`} className="rounded-xl border bg-muted/20 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{item.packageName}</p>
                        <p className="text-sm text-muted-foreground">
                          {t("packageCount", { count: item.bookingCount })}
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-semibold">
                          {isMoneyVisible ? formatCurrency(item.netRevenue) : "Rp •••••••"}
                        </p>
                        <p className="text-muted-foreground">
                          {isMoneyVisible ? formatCurrency(item.grossRevenue) : "Rp •••••••"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed bg-muted/10 px-4 py-5 text-sm text-muted-foreground">
                {t("noPackages")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
