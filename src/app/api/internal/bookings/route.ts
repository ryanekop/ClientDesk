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
  instagram?: string | null;
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
  services: {
    id?: string;
    name: string;
    color?: string | null;
    price?: number;
    duration_minutes?: number | null;
    affects_schedule?: boolean | null;
    is_addon?: boolean | null;
  } | null;
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
  bookingTableColorEnabled?: boolean;
  financeTableColorEnabled?: boolean;
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
      Object.entries(parsed)
        .filter(([, item]) => typeof item === "string")
        .map(([key, item]) => [key, normalizeTextFilterValue(item)]),
    ) as Record<string, string>;
  } catch {
    return {};
  }
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

function readMetadataRows(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (item): item is { event_type?: string | null; extra_fields?: Record<string, unknown> | null } =>
          Boolean(item) && typeof item === "object",
      )
    : [];
}

type ServiceListingMetadata = {
  duration_minutes: number | null;
  affects_schedule: boolean | null;
  color: string | null;
};

function hasMissingServiceListingMetadata(selection: BookingServiceSelection) {
  return (
    selection.service.duration_minutes === null ||
    typeof selection.service.duration_minutes === "undefined" ||
    selection.service.affects_schedule === null ||
    typeof selection.service.affects_schedule === "undefined" ||
    selection.service.color === null ||
    typeof selection.service.color === "undefined"
  );
}

function mergeServiceListingMetadata(
  selection: BookingServiceSelection,
  serviceMetadataById: Map<string, ServiceListingMetadata>,
) {
  const serviceId = selection.service.id;
  const metadata = serviceId ? serviceMetadataById.get(serviceId) : undefined;
  if (!metadata) return selection;

  const nextDuration =
    typeof selection.service.duration_minutes === "number"
      ? selection.service.duration_minutes
      : metadata.duration_minutes;
  const nextAffectsSchedule =
    typeof selection.service.affects_schedule === "boolean"
      ? selection.service.affects_schedule
      : metadata.affects_schedule;
  const nextColor =
    typeof selection.service.color === "string" && selection.service.color.trim().length > 0
      ? selection.service.color
      : metadata.color;

  if (
    nextDuration === selection.service.duration_minutes &&
    nextAffectsSchedule === selection.service.affects_schedule &&
    nextColor === selection.service.color
  ) {
    return selection;
  }

  return {
    ...selection,
    service: {
      ...selection.service,
      duration_minutes: nextDuration,
      affects_schedule: nextAffectsSchedule,
      color: nextColor,
    },
  };
}

function mergeLegacyServiceListingMetadata(
  service: BookingRow["services"],
  serviceMetadataById: Map<string, ServiceListingMetadata>,
) {
  if (!service || !service.id) return service;
  const metadata = serviceMetadataById.get(service.id);
  if (!metadata) return service;

  const nextDuration =
    typeof service.duration_minutes === "number"
      ? service.duration_minutes
      : metadata.duration_minutes;
  const nextAffectsSchedule =
    typeof service.affects_schedule === "boolean"
      ? service.affects_schedule
      : metadata.affects_schedule;
  const nextColor =
    typeof service.color === "string" && service.color.trim().length > 0
      ? service.color
      : metadata.color;

  if (
    nextDuration === service.duration_minutes &&
    nextAffectsSchedule === service.affects_schedule &&
    nextColor === service.color
  ) {
    return service;
  }

  return {
    ...service,
    duration_minutes: nextDuration,
    affects_schedule: nextAffectsSchedule,
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
  const searchQuery = normalizeTextFilterValue(searchParams.get("search"));
  const statusFilters = parseFilterList(searchParams, "statusFilters", "status");
  const packageFilters = parseFilterList(searchParams, "packageFilters", "package");
  const freelanceFilters = parseFilterList(searchParams, "freelanceFilters", "freelance");
  const eventTypeFilters = parseFilterList(searchParams, "eventTypeFilters", "eventType");
  const dateFromFilter = searchParams.get("dateFrom")?.trim() || "";
  const dateToFilter = searchParams.get("dateTo")?.trim() || "";
  const dateBasis = parseDateBasis(searchParams.get("dateBasis"));
  const timeZone = parseTimeZone(searchParams.get("timeZone"));
  const includeMetadata = parseIncludeMetadata(searchParams.get("includeMetadata"));
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

  const metadataPromise = includeMetadata
    ? supabase.rpc("cd_get_bookings_metadata", {
      p_event_type_filter: singleEventTypeFilter,
      p_table_menu: "bookings",
    })
    : Promise.resolve({ data: null, error: null });
  const profileSettingsPromise = includeMetadata && user?.id
    ? supabase
      .from("profiles")
      .select("booking_table_color_enabled, finance_table_color_enabled")
      .eq("id", user.id)
      .maybeSingle()
    : Promise.resolve({ data: null, error: null });
  const [initialPageResult, initialMetadataResult, profileSettingsResult] = await Promise.all([
    supabase.rpc("cd_get_bookings_page", {
      ...basePageRpcArgs,
      p_status_filters: statusFilters,
      p_package_filters: packageFilters,
      p_freelance_filters: freelanceFilters,
      p_event_type_filters: eventTypeFilters,
      p_date_basis: dateBasis,
      p_time_zone: timeZone,
    }),
    metadataPromise,
    profileSettingsPromise,
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
      message.includes("p_time_zone");

    if (isLikelyOldRpcSignature) {
      pageResult = await supabase.rpc("cd_get_bookings_page", basePageRpcArgs);
    }
  }

  if (
    includeMetadata &&
    metadataResult.error &&
    isLikelyMissingRpcArgumentError(metadataResult.error.message || "", "p_table_menu")
  ) {
    metadataResult = await supabase.rpc("cd_get_bookings_metadata", {
      p_event_type_filter: singleEventTypeFilter,
    });
  }

  if (pageResult.error) {
    if (isInvalidEscapeStringError(pageResult.error.message || "")) {
      console.error("[Bookings API] Invalid escape pattern in search/filter", {
        userId: user?.id || null,
        page,
        perPage,
        hasSearchQuery: searchQuery.length > 0,
        statusFilterCount: statusFilters.length,
        packageFilterCount: packageFilters.length,
        freelanceFilterCount: freelanceFilters.length,
        eventTypeFilterCount: eventTypeFilters.length,
        hasExtraFieldFilters: Object.keys(extraFieldFilters).length > 0,
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
      : getBookingStatusOptions(DEFAULT_CLIENT_STATUSES);
  const fallbackInitialStatus = resolvedStatusOptions[0] || "Pending";

  const normalizedBookings = (Array.isArray(pageData?.items) ? pageData.items : []).map((booking) => {
    const junctionFreelancers = (booking.booking_freelance || [])
      .map((bookingFreelance) => bookingFreelance.freelance)
      .filter((item): item is FreelancerInfo => Boolean(item));
    const legacyService = normalizeLegacyServiceRecord(booking.services);
    const serviceSelections = normalizeBookingServiceSelections(
      booking.booking_services,
      booking.services,
    );
    const fallbackRawStatus =
      (typeof booking.client_status === "string" && booking.client_status.trim()) ||
      (typeof booking.status === "string" && booking.status.trim()) ||
      fallbackInitialStatus;
    const syncedStatus = includeMetadata
      ? resolveUnifiedBookingStatus({
        status: booking.status,
        clientStatus: booking.client_status,
        statuses: resolvedStatusOptions,
      })
      : fallbackRawStatus;

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

  const serviceIdsMissingListingMetadata = new Set<string>();
  normalizedBookings.forEach((booking) => {
    (booking.service_selections || []).forEach((selection) => {
      if (!selection.service.id) return;
      if (!hasMissingServiceListingMetadata(selection)) return;
      serviceIdsMissingListingMetadata.add(selection.service.id);
    });
  });

  let bookings = normalizedBookings;

  if (serviceIdsMissingListingMetadata.size > 0) {
    const { data: serviceRows, error: serviceRowsError } = await supabase
      .from("services")
      .select("id, duration_minutes, affects_schedule, color")
      .in("id", Array.from(serviceIdsMissingListingMetadata));

    if (serviceRowsError) {
      console.error(
        "Failed to enrich booking service listing metadata:",
        serviceRowsError.message,
      );
    } else {
      const serviceMetadataById = new Map<string, ServiceListingMetadata>();
      (serviceRows || []).forEach((item) => {
        if (!item || typeof item.id !== "string") return;
        serviceMetadataById.set(item.id, {
          duration_minutes:
            typeof item.duration_minutes === "number"
              ? item.duration_minutes
              : null,
          affects_schedule:
            typeof item.affects_schedule === "boolean"
              ? item.affects_schedule
              : null,
          color: typeof item.color === "string" ? item.color : null,
        });
      });

      bookings = normalizedBookings.map((booking) => ({
        ...booking,
        services: mergeLegacyServiceListingMetadata(
          booking.services,
          serviceMetadataById,
        ),
        service_selections: (booking.service_selections || []).map((selection) =>
          mergeServiceListingMetadata(selection, serviceMetadataById),
        ),
      }));
    }
  }

  if (includeMetadata && profileSettingsResult.error) {
    console.warn(
      "[Bookings API] Failed to load booking color settings from profile:",
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
          bookingTableColorEnabled,
          financeTableColorEnabled,
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
      }
      : {}),
  });
}
