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
  instagram?: string | null;
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
  services: {
    id?: string;
    name: string;
    color?: string | null;
    price: number;
    is_addon?: boolean | null;
  } | null;
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
  availableEventTypes?: string[];
  tableColumnPreferences?: unknown;
  formSectionsByEventType?: Record<string, unknown>;
  metadataRows?: Array<{
    event_type?: string | null;
    extra_fields?: Record<string, unknown> | null;
  }>;
  bookingTableColorEnabled?: boolean;
  financeTableColorEnabled?: boolean;
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

function parseDateBasis(value: string | null) {
  return value?.trim() === "session_date" ? "session_date" : "booking_date";
}

function parseTimeZone(value: string | null) {
  const trimmed = value?.trim() || "";
  if (!trimmed || trimmed.length > 120) return "UTC";
  return trimmed;
}

function parseIncludeMetadata(value: string | null) {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "0" || normalized === "false") {
    return false;
  }
  return true;
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

type ServiceColorMetadata = {
  color: string | null;
};

function hasMissingServiceColor(selection: BookingServiceSelection) {
  return (
    selection.service.color === null ||
    typeof selection.service.color === "undefined" ||
    selection.service.color.trim().length === 0
  );
}

function mergeServiceColorSelection(
  selection: BookingServiceSelection,
  serviceMetadataById: Map<string, ServiceColorMetadata>,
) {
  const serviceId = selection.service.id;
  const metadata = serviceId ? serviceMetadataById.get(serviceId) : undefined;
  if (!metadata) return selection;

  const nextColor =
    typeof selection.service.color === "string" && selection.service.color.trim().length > 0
      ? selection.service.color
      : metadata.color;
  if (nextColor === selection.service.color) return selection;

  return {
    ...selection,
    service: {
      ...selection.service,
      color: nextColor,
    },
  };
}

function mergeLegacyServiceColor(
  service: BookingFinance["services"],
  serviceMetadataById: Map<string, ServiceColorMetadata>,
) {
  if (!service || !service.id) return service;
  const metadata = serviceMetadataById.get(service.id);
  if (!metadata) return service;

  const nextColor =
    typeof service.color === "string" && service.color.trim().length > 0
      ? service.color
      : metadata.color;
  if (nextColor === service.color) return service;

  return {
    ...service,
    color: nextColor,
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
  const eventTypeFilters = parseFilterList(searchParams, "eventTypeFilters", "eventType");
  const dateFromFilter = searchParams.get("dateFrom")?.trim() || "";
  const dateToFilter = searchParams.get("dateTo")?.trim() || "";
  const dateBasis = parseDateBasis(searchParams.get("dateBasis"));
  const timeZone = parseTimeZone(searchParams.get("timeZone"));
  const includeMetadata = parseIncludeMetadata(searchParams.get("includeMetadata"));
  const sortOrder = searchParams.get("sortOrder")?.trim() || "booking_newest";
  const exportAll = searchParams.get("export") === "1";
  const pageRpcArgsBase = {
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
  const pageRpcArgs = {
    ...pageRpcArgsBase,
    p_event_type_filter: eventTypeFilters[0] || "All",
    p_event_type_filters: eventTypeFilters,
    p_date_from: dateFromFilter,
    p_date_to: dateToFilter,
    p_date_basis: dateBasis,
    p_time_zone: timeZone,
    p_sort_order: sortOrder,
  };

  const metadataPromise = includeMetadata
    ? supabase.rpc("cd_get_finance_metadata")
    : Promise.resolve({ data: null, error: null });
  const profileSettingsPromise = includeMetadata && user?.id
    ? supabase
      .from("profiles")
      .select("booking_table_color_enabled, finance_table_color_enabled")
      .eq("id", user.id)
      .maybeSingle()
    : Promise.resolve({ data: null, error: null });
  const [initialPageResult, metadataResult, profileSettingsResult] = await Promise.all([
    supabase.rpc("cd_get_finance_page", pageRpcArgs),
    metadataPromise,
    profileSettingsPromise,
  ]);
  let pageResult = initialPageResult;

  if (pageResult.error) {
    const message = (pageResult.error.message || "").toLowerCase();
    const isLikelyOldRpcSignature =
      message.includes("p_event_type_filter") ||
      message.includes("p_event_type_filters") ||
      message.includes("p_date_from") ||
      message.includes("p_date_to") ||
      message.includes("p_date_basis") ||
      message.includes("p_time_zone") ||
      message.includes("p_sort_order");

    if (isLikelyOldRpcSignature) {
      pageResult = await supabase.rpc("cd_get_finance_page", pageRpcArgsBase);
    }
  }

  if (pageResult.error) {
    console.error("[Finance API] Failed to load finance page", {
      userId: user?.id || null,
      page,
      perPage,
      filter,
      hasSearchQuery: searchQuery.length > 0,
      packageFilterCount: packageFilters.length,
      bookingStatusFilterCount: bookingStatusFilters.length,
      eventTypeFilterCount: eventTypeFilters.length,
      hasDateFromFilter: dateFromFilter.length > 0,
      hasDateToFilter: dateToFilter.length > 0,
      dateBasis,
      sortOrder,
      exportAll,
      error: pageResult.error.message,
    });
    return NextResponse.json(
      { error: "Failed to load finance data." },
      { status: 500 },
    );
  }

  if (includeMetadata && metadataResult.error) {
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
  const metadataData = includeMetadata
    ? readRpcObject<FinanceMetadataResponse>(metadataResult.data)
    : null;
  const bookingStatusOptions = readStringArray(metadataData?.bookingStatusOptions);
  const resolvedBookingStatusOptions =
    bookingStatusOptions.length > 0
      ? bookingStatusOptions
      : getBookingStatusOptions(DEFAULT_CLIENT_STATUSES);
  const fallbackInitialStatus = resolvedBookingStatusOptions[0] || "Pending";

  const normalizedBookings = (Array.isArray(pageData?.items) ? pageData.items : []).map((booking) => {
    const legacyService = normalizeLegacyServiceRecord(booking.services);
    const serviceSelections = normalizeBookingServiceSelections(
      booking.booking_services,
      booking.services,
    );
    const fallbackRawStatus =
      (typeof booking.client_status === "string" && booking.client_status.trim()) ||
      (typeof booking.status === "string" && booking.status.trim()) ||
      fallbackInitialStatus;
    const unifiedStatus = includeMetadata
      ? resolveUnifiedBookingStatus({
        status: booking.status,
        clientStatus: booking.client_status,
        statuses: resolvedBookingStatusOptions,
      })
      : fallbackRawStatus;

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

  const serviceIdsMissingColor = new Set<string>();
  normalizedBookings.forEach((booking) => {
    (booking.service_selections || []).forEach((selection) => {
      if (!selection.service.id) return;
      if (!hasMissingServiceColor(selection)) return;
      serviceIdsMissingColor.add(selection.service.id);
    });
  });

  let bookings = normalizedBookings;

  if (serviceIdsMissingColor.size > 0) {
    const { data: serviceRows, error: serviceRowsError } = await supabase
      .from("services")
      .select("id, color")
      .in("id", Array.from(serviceIdsMissingColor));

    if (serviceRowsError) {
      console.error(
        "[Finance API] Failed to enrich service colors:",
        serviceRowsError.message,
      );
    } else {
      const serviceMetadataById = new Map<string, ServiceColorMetadata>();
      (serviceRows || []).forEach((item) => {
        if (!item || typeof item.id !== "string") return;
        serviceMetadataById.set(item.id, {
          color: typeof item.color === "string" ? item.color : null,
        });
      });

      bookings = normalizedBookings.map((booking) => ({
        ...booking,
        services: mergeLegacyServiceColor(booking.services, serviceMetadataById),
        service_selections: (booking.service_selections || []).map((selection) =>
          mergeServiceColorSelection(selection, serviceMetadataById),
        ),
      }));
    }
  }

  if (includeMetadata && profileSettingsResult.error) {
    console.warn(
      "[Finance API] Failed to load table color settings from profile:",
      profileSettingsResult.error.message,
    );
  }
  const bookingTableColorEnabled =
    profileSettingsResult.data?.booking_table_color_enabled === true;
  const financeTableColorEnabled =
    profileSettingsResult.data?.finance_table_color_enabled === true;

  return NextResponse.json({
    items: bookings,
    totalItems: Number(pageData?.totalItems) || 0,
    ...(includeMetadata
      ? {
        metadata: {
          studioName:
            typeof metadataData?.studioName === "string" ? metadataData.studioName : "",
          bookingStatusOptions: resolvedBookingStatusOptions,
          packageOptions: readStringArray(metadataData?.packageOptions),
          availableEventTypes: readStringArray(metadataData?.availableEventTypes),
          tableColumnPreferences: metadataData?.tableColumnPreferences ?? null,
          formSectionsByEventType:
            metadataData?.formSectionsByEventType &&
            typeof metadataData.formSectionsByEventType === "object"
              ? metadataData.formSectionsByEventType
              : {},
          metadataRows: readMetadataRows(metadataData?.metadataRows),
          bookingTableColorEnabled,
          financeTableColorEnabled,
          summary: readSummary(metadataData?.summary),
        },
      }
      : {}),
  });
}
