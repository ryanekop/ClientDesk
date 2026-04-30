import { NextRequest, NextResponse } from "next/server";

import { normalizeBookingArchiveMode } from "@/lib/booking-archive";
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
import {
  normalizeClientStatusDeadlineDefaultDays,
  normalizeClientStatusDeadlineTriggerStatus,
} from "@/lib/booking-deadline";
import { resolveFastpikProjectInfoFromExtraFields } from "@/lib/fastpik-project-info";
import { mergeStatusMetaWithDefaults } from "@/lib/booking-status-meta";

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 10;
const MAX_PER_PAGE = 100;
const CLIENT_STATUS_SORT_ORDERS = new Set([
  "booking_newest",
  "booking_oldest",
  "session_newest",
  "session_oldest",
  "queue_position_asc",
  "deadline_nearest",
]);

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
}

function normalizeTextFilterValue(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/\\/g, "").trim();
}

function parseStringListValue(rawValue: string) {
  const trimmed = normalizeTextFilterValue(rawValue);
  if (!trimmed) return [] as string[];

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === "string")
        .map((item) => normalizeTextFilterValue(item))
        .filter((item) => item.length > 0);
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
  const normalizedSingleValue = normalizeTextFilterValue(legacySingleValue);
  if (!normalizedSingleValue || normalizedSingleValue.toLowerCase() === "all") {
    return [] as string[];
  }

  return [normalizedSingleValue];
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

function parseArchiveMode(value: string | null) {
  return normalizeBookingArchiveMode(value);
}

function parseSortOrder(value: string | null) {
  const trimmed = value?.trim() || "";
  return CLIENT_STATUS_SORT_ORDERS.has(trimmed) ? trimmed : "booking_newest";
}

function isInvalidEscapeStringError(message: string) {
  return message.toLowerCase().includes("invalid escape string");
}

function isLikelyMissingRpcArgumentError(message: string, argumentName: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes(argumentName.toLowerCase()) &&
    (
      normalized.includes("function") ||
      normalized.includes("parameter") ||
      normalized.includes("signature") ||
      normalized.includes("does not exist") ||
      normalized.includes("could not find")
    )
  );
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
  project_deadline_date: string | null;
  dp_paid?: number | null;
  dp_verified_amount?: number | null;
  dp_verified_at?: string | null;
  dp_refund_amount?: number | null;
  dp_refunded_at?: string | null;
  tracking_uuid: string | null;
  drive_folder_url?: string | null;
  video_drive_folder_url?: string | null;
  fastpik_project_link?: string | null;
  archived_at?: string | null;
  archived_by?: string | null;
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

type BookingSupplementRow = {
  id: string;
  drive_folder_url: string | null;
  video_drive_folder_url: string | null;
  fastpik_project_link: string | null;
  extra_fields: Record<string, unknown> | null;
};

type BookingMetadataResponse = {
  statusOptions?: string[];
  queueTriggerStatus?: string;
  dpVerifyTriggerStatus?: string;
  clientStatusDeadlineTriggerStatus?: string | null;
  clientStatusDeadlineDefaultDays?: number | null;
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
    .select(
      "custom_client_statuses, custom_client_status_meta, client_status_deadline_trigger_status, client_status_deadline_default_days, table_column_preferences",
    )
    .eq("id", user.id)
    .single();

  if (profileResult.error) {
    return NextResponse.json(
      { error: profileResult.error.message },
      { status: 500 },
    );
  }

  const profileData = profileResult.data as {
    custom_client_statuses?: string[] | null;
    custom_client_status_meta?: unknown;
    client_status_deadline_trigger_status?: string | null;
    client_status_deadline_default_days?: number | null;
    table_column_preferences?: { client_status?: unknown } | null;
  } | null;
  const profileStatuses = profileData?.custom_client_statuses || DEFAULT_CLIENT_STATUSES;
  const profileDeadlineTriggerStatus = normalizeClientStatusDeadlineTriggerStatus(
    profileData?.client_status_deadline_trigger_status,
    profileStatuses,
  );
  const profileDeadlineDefaultDays = normalizeClientStatusDeadlineDefaultDays(
    profileData?.client_status_deadline_default_days,
  );
  const profileClientStatusTablePreferences =
    profileData?.table_column_preferences?.client_status ?? null;

  const searchParams = request.nextUrl.searchParams;
  const archiveMode = parseArchiveMode(searchParams.get("archiveMode"));

  const defaultVisibleStatusFilters = getBookingStatusOptions(profileStatuses).filter(
    (status) => archiveMode === "archived" || status !== CANCELLED_BOOKING_STATUS,
  );
  const page = parsePositiveInt(searchParams.get("page"), DEFAULT_PAGE);
  const perPage = Math.min(
    parsePositiveInt(searchParams.get("perPage"), DEFAULT_PER_PAGE),
    MAX_PER_PAGE,
  );
  const searchQuery = normalizeTextFilterValue(searchParams.get("search"));
  const statusFilters = parseFilterList(searchParams, "statusFilters", "status");
  const packageFilters = parseFilterList(searchParams, "packageFilters", "package");
  const eventTypeFilters = parseFilterList(searchParams, "eventTypeFilters", "eventType");
  const dateFromFilter = searchParams.get("dateFrom")?.trim() || "";
  const dateToFilter = searchParams.get("dateTo")?.trim() || "";
  const dateBasis = parseDateBasis(searchParams.get("dateBasis"));
  const timeZone = parseTimeZone(searchParams.get("timeZone"));
  const includeMetadata = parseIncludeMetadata(searchParams.get("includeMetadata"));
  const sortOrder = parseSortOrder(searchParams.get("sortOrder"));

  const effectiveStatusFilters =
    statusFilters.length > 0
      ? (
        archiveMode === "archived"
          ? statusFilters
          : statusFilters.filter((status) => status !== CANCELLED_BOOKING_STATUS)
      )
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
    p_archive_mode: archiveMode,
  };

  const metadataPromise = includeMetadata
    ? supabase.rpc("cd_get_bookings_metadata", {
      p_event_type_filter: eventTypeFilters[0] || "All",
      p_table_menu: "client_status",
      p_archive_mode: archiveMode,
    })
    : Promise.resolve({ data: null, error: null });

  const [initialPageResult, initialMetadataResult] = await Promise.all([
    supabase.rpc("cd_get_bookings_page", pageRpcArgs),
    metadataPromise,
  ]);

  let pageResult = initialPageResult;
  let metadataResult = initialMetadataResult;

  if (pageResult.error) {
    const message = (pageResult.error.message || "").toLowerCase();
    const isLikelyOldRpcSignature =
      message.includes("p_status_filters") ||
      message.includes("p_package_filters") ||
      message.includes("p_freelance_filters") ||
      message.includes("p_event_type_filters") ||
      message.includes("p_date_basis") ||
      message.includes("p_time_zone") ||
      message.includes("p_archive_mode");

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
    if (isInvalidEscapeStringError(pageResult.error.message || "")) {
      console.error("[ClientStatus API] Invalid escape pattern in search/filter", {
        userId: user?.id || null,
        page,
        perPage,
        hasSearchQuery: searchQuery.length > 0,
        statusFilterCount: statusFilters.length,
        packageFilterCount: packageFilters.length,
        eventTypeFilterCount: eventTypeFilters.length,
        error: pageResult.error.message,
      });
      return NextResponse.json(
        { error: "Search/filter text contains an unsupported escape pattern." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: pageResult.error.message },
      { status: 500 },
    );
  }

  if (
    includeMetadata &&
    metadataResult.error &&
    isLikelyMissingRpcArgumentError(metadataResult.error.message || "", "p_table_menu")
  ) {
    metadataResult = await supabase.rpc("cd_get_bookings_metadata", {
      p_event_type_filter: eventTypeFilters[0] || "All",
      p_archive_mode: archiveMode,
    });
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

  const baseItems = Array.isArray(pageData?.items) ? pageData.items : [];
  const bookingIds = baseItems
    .map((booking) => booking.id)
    .filter((bookingId): bookingId is string => typeof bookingId === "string" && bookingId.length > 0);

  let supplementMap = new Map<string, BookingSupplementRow>();
  if (bookingIds.length > 0) {
    const { data: supplementRows } = await supabase
      .from("bookings")
      .select("id, drive_folder_url, video_drive_folder_url, fastpik_project_link, extra_fields")
      .in("id", bookingIds);

    supplementMap = new Map(
      (Array.isArray(supplementRows) ? supplementRows : [])
        .filter(
          (row): row is BookingSupplementRow =>
            Boolean(row) &&
            typeof row === "object" &&
            typeof (row as { id?: unknown }).id === "string",
        )
        .map((row) => [row.id, row]),
    );
  }

  const items = baseItems.map((booking) => {
    const supplement = supplementMap.get(booking.id);
    const resolvedExtraFields =
      supplement?.extra_fields !== undefined
        ? supplement.extra_fields
        : booking.extra_fields;
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
      drive_folder_url:
        supplement?.drive_folder_url !== undefined
          ? supplement.drive_folder_url
          : booking.drive_folder_url ?? null,
      video_drive_folder_url:
        supplement?.video_drive_folder_url !== undefined
          ? supplement.video_drive_folder_url
          : booking.video_drive_folder_url ?? null,
      fastpik_project_link:
        supplement?.fastpik_project_link !== undefined
          ? supplement.fastpik_project_link
          : booking.fastpik_project_link ?? null,
      extra_fields: resolvedExtraFields,
      fastpik_project_info: resolveFastpikProjectInfoFromExtraFields(
        resolvedExtraFields,
      ),
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
      customClientStatusMeta: mergeStatusMetaWithDefaults(
        resolvedStatusOptions,
        profileData?.custom_client_status_meta,
      ),
      queueTriggerStatus:
        typeof metadataData?.queueTriggerStatus === "string"
          ? metadataData.queueTriggerStatus
          : "Antrian Edit",
      dpVerifyTriggerStatus: metadataData?.dpVerifyTriggerStatus || "",
      clientStatusDeadlineTriggerStatus: profileDeadlineTriggerStatus,
      clientStatusDeadlineDefaultDays: profileDeadlineDefaultDays,
      packages: readStringArray(metadataData?.packages),
      availableEventTypes: readStringArray(metadataData?.availableEventTypes),
      tableColumnPreferences:
        profileClientStatusTablePreferences ??
        metadataData?.tableColumnPreferences ??
        null,
      formSectionsByEventType:
        metadataData?.formSectionsByEventType &&
        typeof metadataData.formSectionsByEventType === "object"
          ? metadataData.formSectionsByEventType
          : {},
      metadataRows,
    },
  });
}
