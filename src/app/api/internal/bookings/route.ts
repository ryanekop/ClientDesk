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

type FreelancerInfo = {
  id: string;
  name: string;
  whatsapp_number: string | null;
};

type BookingRow = {
  id: string;
  booking_code: string;
  client_name: string;
  client_whatsapp: string | null;
  booking_date: string | null;
  session_date: string | null;
  status: string;
  client_status: string | null;
  queue_position: number | null;
  total_price: number;
  dp_paid: number;
  dp_verified_amount?: number | null;
  dp_verified_at?: string | null;
  dp_refund_amount?: number | null;
  dp_refunded_at?: string | null;
  drive_folder_url: string | null;
  fastpik_project_id: string | null;
  fastpik_project_link: string | null;
  fastpik_project_edit_link: string | null;
  location: string | null;
  location_lat: number | null;
  location_lng: number | null;
  notes: string | null;
  services: { id?: string; name: string; price?: number; is_addon?: boolean | null } | null;
  event_type: string | null;
  freelance?: FreelancerInfo | null;
  booking_freelance?: Array<{ freelance_id?: string | null; freelance: FreelancerInfo | null }>;
  booking_freelancers: FreelancerInfo[];
  tracking_uuid: string | null;
  location_detail: string | null;
  extra_fields?: Record<string, unknown> | null;
  booking_services?: unknown[];
  service_selections?: BookingServiceSelection[];
  service_label?: string;
  created_at?: string;
};

type BookingPageRpcResponse = {
  items?: BookingRow[];
  totalItems?: number;
};

type BookingMetadataResponse = {
  studioName?: string;
  statusOptions?: string[];
  queueTriggerStatus?: string;
  dpVerifyTriggerStatus?: string;
  defaultWaTarget?: "client" | "freelancer";
  packages?: string[];
  freelancerNames?: string[];
  availableEventTypes?: string[];
  formSectionsByEventType?: Record<string, unknown>;
  tableColumnPreferences?: unknown;
  metadataRows?: Array<{
    event_type?: string | null;
    extra_fields?: Record<string, unknown> | null;
  }>;
  extraFieldRows?: Array<{
    event_type?: string | null;
    extra_fields?: Record<string, unknown> | null;
  }>;
};

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
}

function parseExtraFilters(value: string | null) {
  if (!value) return {} as Record<string, string>;

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter(([, item]) => typeof item === "string"),
    ) as Record<string, string>;
  } catch {
    return {};
  }
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

export async function GET(request: NextRequest) {
  const { errorResponse, supabase } = await requireRouteUser();
  if (errorResponse) {
    return errorResponse;
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parsePositiveInt(searchParams.get("page"), DEFAULT_PAGE);
  const perPage = Math.min(
    parsePositiveInt(searchParams.get("perPage"), DEFAULT_PER_PAGE),
    MAX_PER_PAGE,
  );
  const searchQuery = searchParams.get("search")?.trim() || "";
  const statusFilters = parseFilterList(searchParams, "statusFilters", "status");
  const packageFilters = parseFilterList(searchParams, "packageFilters", "package");
  const freelanceFilters = parseFilterList(searchParams, "freelanceFilters", "freelance");
  const eventTypeFilters = parseFilterList(searchParams, "eventTypeFilters", "eventType");
  const dateFromFilter = searchParams.get("dateFrom")?.trim() || "";
  const dateToFilter = searchParams.get("dateTo")?.trim() || "";
  const dateBasis = parseDateBasis(searchParams.get("dateBasis"));
  const timeZone = parseTimeZone(searchParams.get("timeZone"));
  const sortOrder = searchParams.get("sortOrder")?.trim() || "booking_newest";
  const exportAll = searchParams.get("export") === "1";
  const extraFieldFilters = parseExtraFilters(searchParams.get("extraFilters"));
  const singleEventTypeFilter = eventTypeFilters.length === 1 ? eventTypeFilters[0] : "All";

  const basePageRpcArgs = {
    p_page: page,
    p_per_page: perPage,
    p_search: searchQuery,
    p_status_filter: statusFilters[0] || "All",
    p_package_filter: packageFilters[0] || "All",
    p_freelance_filter: freelanceFilters[0] || "All",
    p_event_type_filter: singleEventTypeFilter,
    p_date_from: dateFromFilter,
    p_date_to: dateToFilter,
    p_sort_order: sortOrder,
    p_extra_filters: extraFieldFilters,
    p_export_all: exportAll,
  };

  const [initialPageResult, metadataResult] = await Promise.all([
    supabase.rpc("cd_get_bookings_page", {
      ...basePageRpcArgs,
      p_status_filters: statusFilters,
      p_package_filters: packageFilters,
      p_freelance_filters: freelanceFilters,
      p_event_type_filters: eventTypeFilters,
      p_date_basis: dateBasis,
      p_time_zone: timeZone,
    }),
    supabase.rpc("cd_get_bookings_metadata", {
      p_event_type_filter: singleEventTypeFilter,
    }),
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
      pageResult = await supabase.rpc("cd_get_bookings_page", basePageRpcArgs);
    }
  }

  if (pageResult.error) {
    return NextResponse.json(
      { error: pageResult.error.message },
      { status: 500 },
    );
  }

  if (metadataResult.error) {
    return NextResponse.json(
      { error: metadataResult.error.message },
      { status: 500 },
    );
  }

  const pageData = readRpcObject<BookingPageRpcResponse>(pageResult.data);
  const metadataData = readRpcObject<BookingMetadataResponse>(metadataResult.data);
  const statusOptions = readStringArray(metadataData?.statusOptions);
  const resolvedStatusOptions =
    statusOptions.length > 0
      ? statusOptions
      : getBookingStatusOptions(DEFAULT_CLIENT_STATUSES);

  const bookings = (Array.isArray(pageData?.items) ? pageData.items : []).map((booking) => {
    const junctionFreelancers = (booking.booking_freelance || [])
      .map((bookingFreelance) => bookingFreelance.freelance)
      .filter((item): item is FreelancerInfo => Boolean(item));
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
      booking_freelancers:
        junctionFreelancers.length > 0
          ? junctionFreelancers
          : booking.freelance
            ? [booking.freelance]
            : [],
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
      statusOptions: resolvedStatusOptions,
      queueTriggerStatus:
        typeof metadataData?.queueTriggerStatus === "string"
          ? metadataData.queueTriggerStatus
          : "Antrian Edit",
      dpVerifyTriggerStatus:
        typeof metadataData?.dpVerifyTriggerStatus === "string"
          ? metadataData.dpVerifyTriggerStatus
          : "",
      defaultWaTarget:
        metadataData?.defaultWaTarget === "freelancer" ? "freelancer" : "client",
      packages: readStringArray(metadataData?.packages),
      freelancerNames: readStringArray(metadataData?.freelancerNames),
      availableEventTypes: readStringArray(metadataData?.availableEventTypes),
      formSectionsByEventType:
        metadataData?.formSectionsByEventType &&
        typeof metadataData.formSectionsByEventType === "object"
          ? metadataData.formSectionsByEventType
          : {},
      tableColumnPreferences: metadataData?.tableColumnPreferences ?? null,
      metadataRows: readMetadataRows(metadataData?.metadataRows),
      extraFieldRows: readMetadataRows(metadataData?.extraFieldRows),
    },
  });
}
