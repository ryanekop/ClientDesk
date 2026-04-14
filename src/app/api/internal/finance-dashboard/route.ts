import { NextRequest, NextResponse } from "next/server";

import { requireRouteUser } from "@/lib/pagination/route-user";

type FinanceDashboardSummary = {
  grossRevenue?: number;
  operationalCosts?: number;
  netRevenue?: number;
  verifiedDp?: number;
  outstandingBalance?: number;
  bookingCount?: number;
};

type FinanceDashboardSourceRow = {
  sourceKey?: string;
  label?: string;
  amount?: number;
};

type FinanceDashboardChartRow = {
  periodKey?: string;
  grossRevenue?: number;
  verifiedDp?: number;
  operationalCosts?: number;
  netRevenue?: number;
};

type FinanceDashboardPackageRow = {
  packageName?: string;
  bookingCount?: number;
  grossRevenue?: number;
  netRevenue?: number;
};

type FinanceDashboardResponse = {
  selectedPeriod?: string;
  currentPeriod?: string;
  availablePeriods?: string[];
  summary?: FinanceDashboardSummary;
  sourceBreakdown?: FinanceDashboardSourceRow[];
  monthlyChart?: FinanceDashboardChartRow[];
  topPackages?: FinanceDashboardPackageRow[];
};

function readRpcObject<T>(value: unknown): T | null {
  if (Array.isArray(value)) {
    const firstItem = value[0];
    return firstItem && typeof firstItem === "object" ? (firstItem as T) : null;
  }

  return value && typeof value === "object" ? (value as T) : null;
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function readObjectArray<T extends object>(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is T => Boolean(item) && typeof item === "object")
    : [];
}

function readSummary(value: unknown) {
  if (!value || typeof value !== "object") {
    return {
      grossRevenue: 0,
      operationalCosts: 0,
      netRevenue: 0,
      verifiedDp: 0,
      outstandingBalance: 0,
      bookingCount: 0,
    };
  }

  const summary = value as Record<string, unknown>;
  return {
    grossRevenue: Number(summary.grossRevenue) || 0,
    operationalCosts: Number(summary.operationalCosts) || 0,
    netRevenue: Number(summary.netRevenue) || 0,
    verifiedDp: Number(summary.verifiedDp) || 0,
    outstandingBalance: Number(summary.outstandingBalance) || 0,
    bookingCount: Number(summary.bookingCount) || 0,
  };
}

export async function GET(request: NextRequest) {
  const { errorResponse, supabase, user } = await requireRouteUser();
  if (errorResponse) return errorResponse;

  const searchParams = request.nextUrl.searchParams;
  const rawPeriod = searchParams.get("period")?.trim() || "all";
  const period = rawPeriod === "all" || /^\d{4}-\d{2}$/.test(rawPeriod) ? rawPeriod : "all";
  const timeZone = searchParams.get("timeZone")?.trim() || "UTC";

  const [{ data, error }, { data: profile }] = await Promise.all([
    supabase.rpc("cd_get_finance_dashboard", {
      p_period: period,
      p_time_zone: timeZone,
    }),
    supabase
      .from("profiles")
      .select("role")
      .eq("id", user!.id)
      .maybeSingle(),
  ]);

  if (error) {
    console.error("[Finance Dashboard API] Failed to load dashboard", {
      period,
      timeZone,
      error: error.message,
    });
    return NextResponse.json(
      { error: "Failed to load finance dashboard." },
      { status: 500 },
    );
  }

  const payload = readRpcObject<FinanceDashboardResponse>(data);
  const canViewOperationalCosts =
    typeof profile?.role === "string" &&
    profile.role.trim().toLowerCase() === "admin";
  const summary = readSummary(payload?.summary);
  const monthlyChart = readObjectArray<FinanceDashboardChartRow>(payload?.monthlyChart).map((item) => {
    const grossRevenue = Number(item.grossRevenue) || 0;
    const operationalCosts = canViewOperationalCosts ? Number(item.operationalCosts) || 0 : 0;
    return {
      periodKey: typeof item.periodKey === "string" ? item.periodKey : "",
      grossRevenue,
      verifiedDp: Number(item.verifiedDp) || 0,
      operationalCosts,
      netRevenue: canViewOperationalCosts ? Number(item.netRevenue) || 0 : grossRevenue,
    };
  });
  const topPackages = readObjectArray<FinanceDashboardPackageRow>(payload?.topPackages).map((item) => {
    const grossRevenue = Number(item.grossRevenue) || 0;
    return {
      packageName: typeof item.packageName === "string" ? item.packageName : "-",
      bookingCount: Number(item.bookingCount) || 0,
      grossRevenue,
      netRevenue: canViewOperationalCosts ? Number(item.netRevenue) || 0 : grossRevenue,
    };
  });

  return NextResponse.json({
    canViewOperationalCosts,
    selectedPeriod:
      typeof payload?.selectedPeriod === "string" ? payload.selectedPeriod : "all",
    currentPeriod:
      typeof payload?.currentPeriod === "string" ? payload.currentPeriod : "",
    availablePeriods: readStringArray(payload?.availablePeriods),
    summary: {
      ...summary,
      operationalCosts: canViewOperationalCosts ? summary.operationalCosts : 0,
      netRevenue: canViewOperationalCosts ? summary.netRevenue : summary.grossRevenue,
    },
    sourceBreakdown: readObjectArray<FinanceDashboardSourceRow>(payload?.sourceBreakdown).map((item) => ({
      sourceKey: typeof item.sourceKey === "string" ? item.sourceKey : "unknown",
      label: typeof item.label === "string" ? item.label : "",
      amount: Number(item.amount) || 0,
    })),
    monthlyChart,
    topPackages,
  });
}
