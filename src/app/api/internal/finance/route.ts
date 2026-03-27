import { NextRequest, NextResponse } from "next/server";

import { requireRouteUser } from "@/lib/pagination/route-user";
import {
  getBookingServiceLabel,
  normalizeBookingServiceSelections,
  normalizeLegacyServiceRecord,
  type BookingServiceSelection,
} from "@/lib/booking-services";
import {
  DEFAULT_CLIENT_STATUSES,
  getBookingStatusOptions,
  resolveUnifiedBookingStatus,
} from "@/lib/client-status";

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 10;
const MAX_PER_PAGE = 100;

type BookingFinance = {
  id: string;
  booking_code: string;
  client_name: string;
  client_whatsapp: string | null;
  total_price: number;
  dp_paid: number;
  dp_verified_amount: number;
  dp_verified_at: string | null;
  dp_refund_amount: number;
  dp_refunded_at: string | null;
  is_fully_paid: boolean;
  status: string;
  session_date: string | null;
  event_type: string | null;
  location: string | null;
  location_lat: number | null;
  location_lng: number | null;
  tracking_uuid: string | null;
  client_status: string | null;
  settlement_status: string | null;
  final_adjustments: unknown;
  final_payment_amount: number;
  final_paid_at: string | null;
  final_invoice_sent_at: string | null;
  payment_proof_url: string | null;
  payment_proof_drive_file_id: string | null;
  final_payment_proof_url: string | null;
  final_payment_proof_drive_file_id: string | null;
  extra_fields?: Record<string, unknown> | null;
  services: { id?: string; name: string; price: number; is_addon?: boolean | null } | null;
  booking_services?: unknown[];
  service_selections?: BookingServiceSelection[];
  service_label?: string;
};

type FinancePageRpcResponse = {
  items?: BookingFinance[];
  totalItems?: number;
};

type FinanceMetadataResponse = {
  studioName?: string;
  bookingStatusOptions?: string[];
  packageOptions?: string[];
  tableColumnPreferences?: unknown;
  formSectionsByEventType?: Record<string, unknown>;
  metadataRows?: Array<{
    event_type?: string | null;
    extra_fields?: Record<string, unknown> | null;
  }>;
  summary?: {
    totalRevenue?: number;
    totalPending?: number;
    totalDP?: number;
    totalBookings?: number;
    paidCount?: number;
    unpaidCount?: number;
    monthlyRevenueTotal?: number;
  };
};

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
}

function parseStringListValue(rawValue: string) {
  const trimmed = rawValue.trim();
  if (!trimmed) return [] as string[];

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    // Fallback to CSV parsing.
  }

  return trimmed.split(",");
}

function parseFilterList(
  searchParams: URLSearchParams,
  listKey: string,
  singleKey: string,
) {
  const seen = new Set<string>();
  const normalized: string[] = [];
  const listValues = searchParams.getAll(listKey);

  listValues.forEach((rawValue) => {
    parseStringListValue(rawValue).forEach((candidate) => {
      const trimmed = candidate.trim();
      if (!trimmed || trimmed.toLowerCase() === "all" || seen.has(trimmed)) return;
      seen.add(trimmed);
      normalized.push(trimmed);
    });
  });

  if (normalized.length > 0) {
    return normalized;
  }

  const legacySingleValue = searchParams.get(singleKey)?.trim() || "";
  if (!legacySingleValue || legacySingleValue.toLowerCase() === "all") {
    return [] as string[];
  }

  return [legacySingleValue];
}

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

function readMetadataRows(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (item): item is { event_type?: string | null; extra_fields?: Record<string, unknown> | null } =>
          Boolean(item) && typeof item === "object",
      )
    : [];
}

function readSummary(value: unknown) {
  if (!value || typeof value !== "object") {
    return {
      totalRevenue: 0,
      totalPending: 0,
      totalDP: 0,
      totalBookings: 0,
      paidCount: 0,
      unpaidCount: 0,
      monthlyRevenueTotal: 0,
    };
  }

  const summary = value as Record<string, unknown>;

  return {
    totalRevenue: Number(summary.totalRevenue) || 0,
    totalPending: Number(summary.totalPending) || 0,
    totalDP: Number(summary.totalDP) || 0,
    totalBookings: Number(summary.totalBookings) || 0,
    paidCount: Number(summary.paidCount) || 0,
    unpaidCount: Number(summary.unpaidCount) || 0,
    monthlyRevenueTotal: Number(summary.monthlyRevenueTotal) || 0,
  };
}

export async function GET(request: NextRequest) {
  const { errorResponse, supabase, user } = await requireRouteUser();
  if (errorResponse) {
    return errorResponse;
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parsePositiveInt(searchParams.get("page"), DEFAULT_PAGE);
  const perPage = Math.min(
    parsePositiveInt(searchParams.get("perPage"), DEFAULT_PER_PAGE),
    MAX_PER_PAGE,
  );
  const filter = searchParams.get("filter")?.trim() || "all";
  const searchQuery = searchParams.get("search")?.trim() || "";
  const packageFilters = parseFilterList(searchParams, "packageFilters", "package");
  const bookingStatusFilters = parseFilterList(
    searchParams,
    "bookingStatusFilters",
    "bookingStatus",
  );
  const exportAll = searchParams.get("export") === "1";
  const pageRpcArgs = {
    p_page: page,
    p_per_page: perPage,
    p_filter: filter,
    p_search: searchQuery,
    p_package_filter: packageFilters[0] || "All",
    p_booking_status_filter: bookingStatusFilters[0] || "All",
    p_package_filters: packageFilters,
    p_booking_status_filters: bookingStatusFilters,
    p_export_all: exportAll,
  };

  const [pageResult, metadataResult] = await Promise.all([
    supabase.rpc("cd_get_finance_page", pageRpcArgs),
    supabase.rpc("cd_get_finance_metadata"),
  ]);

  if (pageResult.error) {
    console.error("[Finance API] Failed to load finance page", {
      userId: user?.id || null,
      page,
      perPage,
      filter,
      hasSearchQuery: searchQuery.length > 0,
      packageFilterCount: packageFilters.length,
      bookingStatusFilterCount: bookingStatusFilters.length,
      exportAll,
      error: pageResult.error.message,
    });
    return NextResponse.json(
      { error: "Failed to load finance data." },
      { status: 500 },
    );
  }

  if (metadataResult.error) {
    console.error("[Finance API] Failed to load finance metadata", {
      userId: user?.id || null,
      error: metadataResult.error.message,
    });
    return NextResponse.json(
      { error: "Failed to load finance metadata." },
      { status: 500 },
    );
  }

  const pageData = readRpcObject<FinancePageRpcResponse>(pageResult.data);
  const metadataData = readRpcObject<FinanceMetadataResponse>(metadataResult.data);
  const bookingStatusOptions = readStringArray(metadataData?.bookingStatusOptions);
  const resolvedBookingStatusOptions =
    bookingStatusOptions.length > 0
      ? bookingStatusOptions
      : getBookingStatusOptions(DEFAULT_CLIENT_STATUSES);

  const bookings = (Array.isArray(pageData?.items) ? pageData.items : []).map((booking) => {
    const legacyService = normalizeLegacyServiceRecord(booking.services);
    const serviceSelections = normalizeBookingServiceSelections(
      booking.booking_services,
      booking.services,
    );
    const unifiedStatus = resolveUnifiedBookingStatus({
      status: booking.status,
      clientStatus: booking.client_status,
      statuses: resolvedBookingStatusOptions,
    });

    return {
      ...booking,
      status: unifiedStatus,
      client_status: unifiedStatus,
      service_selections: serviceSelections,
      service_label: getBookingServiceLabel(serviceSelections, {
        kind: "main",
        fallback: legacyService?.name || "-",
      }),
    };
  });

  return NextResponse.json({
    items: bookings,
    totalItems: Number(pageData?.totalItems) || 0,
    metadata: {
      studioName:
        typeof metadataData?.studioName === "string" ? metadataData.studioName : "",
      bookingStatusOptions: resolvedBookingStatusOptions,
      packageOptions: readStringArray(metadataData?.packageOptions),
      tableColumnPreferences: metadataData?.tableColumnPreferences ?? null,
      formSectionsByEventType:
        metadataData?.formSectionsByEventType &&
        typeof metadataData.formSectionsByEventType === "object"
          ? metadataData.formSectionsByEventType
          : {},
      metadataRows: readMetadataRows(metadataData?.metadataRows),
      summary: readSummary(metadataData?.summary),
    },
  });
}
