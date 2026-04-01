import { NextRequest, NextResponse } from "next/server";

import { requireRouteUser } from "@/lib/pagination/route-user";
import {
  CANCELLED_BOOKING_STATUS,
  DEFAULT_CLIENT_STATUSES,
  getBookingStatusOptions,
  resolveUnifiedBookingStatus,
} from "@/lib/client-status";
import {
  getBookingServiceLabel,
  normalizeBookingServiceSelections,
  normalizeLegacyServiceRecord,
  type BookingServiceSelection,
} from "@/lib/booking-services";

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 10;
const MAX_PER_PAGE = 100;

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

type BookingStatusRow = {
  id: string;
  booking_code: string;
  client_name: string;
  client_whatsapp: string | null;
  session_date: string | null;
  status: string;
  client_status: string | null;
  queue_position: number | null;
  dp_paid?: number | null;
  dp_verified_amount?: number | null;
  dp_verified_at?: string | null;
  dp_refund_amount?: number | null;
  dp_refunded_at?: string | null;
  tracking_uuid: string | null;
  event_type?: string | null;
  extra_fields?: Record<string, unknown> | null;
  services: {
    id?: string;
    name: string;
    price?: number;
    is_addon?: boolean | null;
  } | null;
  booking_services?: unknown[];
  service_selections?: BookingServiceSelection[];
  service_label?: string;
};

type BookingPageRpcResponse = {
  items?: BookingStatusRow[];
  totalItems?: number;
};

type BookingMetadataResponse = {
  statusOptions?: string[];
  queueTriggerStatus?: string;
  dpVerifyTriggerStatus?: string;
  packages?: string[];
  availableEventTypes?: string[];
  tableColumnPreferences?: unknown;
  formSectionsByEventType?: Record<string, unknown>;
  metadataRows?: Array<{
    event_type?: string | null;
    extra_fields?: Record<string, unknown> | null;
  }>;
};

export async function GET(request: NextRequest) {
  const { errorResponse, supabase, user } = await requireRouteUser();
  if (errorResponse || !user) {
    return errorResponse;
  }

  const profileResult = await supabase
    .from("profiles")
    .select("custom_client_statuses")
    .eq("id", user.id)
    .single();

  if (profileResult.error) {
    return NextResponse.json(
      { error: profileResult.error.message },
      { status: 500 },
    );
  }

  const profileStatuses =
    ((profileResult.data as { custom_client_statuses?: string[] | null } | null)
      ?.custom_client_statuses || DEFAULT_CLIENT_STATUSES);

  const defaultVisibleStatusFilters = getBookingStatusOptions(profileStatuses).filter(
    (status) => status !== CANCELLED_BOOKING_STATUS,
  );

  const searchParams = request.nextUrl.searchParams;
  const page = parsePositiveInt(searchParams.get("page"), DEFAULT_PAGE);
  const perPage = Math.min(
    parsePositiveInt(searchParams.get("perPage"), DEFAULT_PER_PAGE),
    MAX_PER_PAGE,
  );
  const searchQuery = searchParams.get("search")?.trim() || "";
  const statusFilters = parseFilterList(searchParams, "statusFilters", "status");
  const packageFilters = parseFilterList(searchParams, "packageFilters", "package");
  const eventTypeFilters = parseFilterList(searchParams, "eventTypeFilters", "eventType");
  const dateFromFilter = searchParams.get("dateFrom")?.trim() || "";
  const dateToFilter = searchParams.get("dateTo")?.trim() || "";
  const dateBasis = parseDateBasis(searchParams.get("dateBasis"));
  const timeZone = parseTimeZone(searchParams.get("timeZone"));
  const includeMetadata = parseIncludeMetadata(searchParams.get("includeMetadata"));
  const sortOrder = searchParams.get("sortOrder")?.trim() || "booking_newest";

  const effectiveStatusFilters =
    statusFilters.length > 0
      ? statusFilters.filter((status) => status !== CANCELLED_BOOKING_STATUS)
      : defaultVisibleStatusFilters;
  const normalizedStatusFilters =
    statusFilters.length > 0 && effectiveStatusFilters.length === 0
      ? ["__NO_VISIBLE_STATUS__"]
      : effectiveStatusFilters;

  const pageRpcArgs = {
    p_page: page,
    p_per_page: perPage,
    p_search: searchQuery,
    p_status_filter: normalizedStatusFilters[0] || "All",
    p_package_filter: packageFilters[0] || "All",
    p_freelance_filter: "All",
    p_event_type_filter: eventTypeFilters[0] || "All",
    p_date_from: dateFromFilter,
    p_date_to: dateToFilter,
    p_sort_order: sortOrder,
    p_extra_filters: {},
    p_export_all: false,
    p_status_filters: normalizedStatusFilters,
    p_package_filters: packageFilters,
    p_freelance_filters: [] as string[],
    p_event_type_filters: eventTypeFilters,
    p_date_basis: dateBasis,
    p_time_zone: timeZone,
  };

  const metadataPromise = includeMetadata
    ? supabase.rpc("cd_get_bookings_metadata", {
      p_event_type_filter: eventTypeFilters[0] || "All",
    })
    : Promise.resolve({ data: null, error: null });

  const [initialPageResult, metadataResult] = await Promise.all([
    supabase.rpc("cd_get_bookings_page", pageRpcArgs),
    metadataPromise,
  ]);

  let pageResult = initialPageResult;

  if (pageResult.error) {
    const message = (pageResult.error.message || "").toLowerCase();
    const isLikelyOldRpcSignature =
      message.includes("p_status_filters") ||
      message.includes("p_package_filters") ||
      message.includes("p_freelance_filters") ||
      message.includes("p_event_type_filters") ||
      message.includes("p_date_basis") ||
      message.includes("p_time_zone");

    if (isLikelyOldRpcSignature) {
      pageResult = await supabase.rpc("cd_get_bookings_page", {
        p_page: page,
        p_per_page: perPage,
        p_search: searchQuery,
        p_status_filter: normalizedStatusFilters[0] || "All",
        p_package_filter: packageFilters[0] || "All",
        p_freelance_filter: "All",
        p_event_type_filter: eventTypeFilters[0] || "All",
        p_date_from: dateFromFilter,
        p_date_to: dateToFilter,
        p_sort_order: sortOrder,
        p_extra_filters: {},
        p_export_all: false,
      });
    }
  }

  if (pageResult.error) {
    return NextResponse.json(
      { error: pageResult.error.message },
      { status: 500 },
    );
  }

  if (includeMetadata && metadataResult.error) {
    return NextResponse.json(
      { error: metadataResult.error.message },
      { status: 500 },
    );
  }

  const pageData = readRpcObject<BookingPageRpcResponse>(pageResult.data);
  const metadataData = includeMetadata
    ? readRpcObject<BookingMetadataResponse>(metadataResult.data)
    : null;

  const statusOptions = readStringArray(metadataData?.statusOptions);
  const resolvedStatusOptions =
    statusOptions.length > 0
      ? statusOptions
      : getBookingStatusOptions(profileStatuses);

  const items = (Array.isArray(pageData?.items) ? pageData.items : []).map((booking) => {
    const legacyService = normalizeLegacyServiceRecord(booking.services);
    const serviceSelections = normalizeBookingServiceSelections(
      booking.booking_services,
      booking.services,
    );
    const syncedStatus = resolveUnifiedBookingStatus({
      status: booking.status,
      clientStatus: booking.client_status,
      statuses: resolvedStatusOptions,
    });

    return {
      ...booking,
      status: syncedStatus,
      client_status: syncedStatus,
      service_selections: serviceSelections,
      service_label: getBookingServiceLabel(serviceSelections, {
        kind: "main",
        fallback: legacyService?.name || "-",
      }),
    };
  });

  const metadataRows = Array.isArray(metadataData?.metadataRows)
    ? metadataData.metadataRows.filter(
      (item): item is { event_type?: string | null; extra_fields?: Record<string, unknown> | null } =>
        Boolean(item) && typeof item === "object",
    )
    : [];

  return NextResponse.json({
    items,
    totalItems: Number(pageData?.totalItems) || 0,
    metadata: {
      clientStatuses: resolvedStatusOptions.filter(
        (status) => status !== CANCELLED_BOOKING_STATUS,
      ),
      queueTriggerStatus: metadataData?.queueTriggerStatus || "Antrian Edit",
      dpVerifyTriggerStatus: metadataData?.dpVerifyTriggerStatus || "",
      packages: readStringArray(metadataData?.packages),
      availableEventTypes: readStringArray(metadataData?.availableEventTypes),
      tableColumnPreferences: metadataData?.tableColumnPreferences ?? null,
      formSectionsByEventType:
        metadataData?.formSectionsByEventType &&
        typeof metadataData.formSectionsByEventType === "object"
          ? metadataData.formSectionsByEventType
          : {},
      metadataRows,
    },
  });
}
