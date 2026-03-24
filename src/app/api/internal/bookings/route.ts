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
  const statusFilter = searchParams.get("status")?.trim() || "All";
  const packageFilter = searchParams.get("package")?.trim() || "All";
  const freelanceFilter = searchParams.get("freelance")?.trim() || "All";
  const eventTypeFilter = searchParams.get("eventType")?.trim() || "All";
  const dateFromFilter = searchParams.get("dateFrom")?.trim() || "";
  const dateToFilter = searchParams.get("dateTo")?.trim() || "";
  const sortOrder = searchParams.get("sortOrder")?.trim() || "booking_newest";
  const exportAll = searchParams.get("export") === "1";
  const extraFieldFilters = parseExtraFilters(searchParams.get("extraFilters"));

  const [pageResult, metadataResult] = await Promise.all([
    supabase.rpc("cd_get_bookings_page", {
      p_page: page,
      p_per_page: perPage,
      p_search: searchQuery,
      p_status_filter: statusFilter,
      p_package_filter: packageFilter,
      p_freelance_filter: freelanceFilter,
      p_event_type_filter: eventTypeFilter,
      p_date_from: dateFromFilter,
      p_date_to: dateToFilter,
      p_sort_order: sortOrder,
      p_extra_filters: extraFieldFilters,
      p_export_all: exportAll,
    }),
    supabase.rpc("cd_get_bookings_metadata", {
      p_event_type_filter: eventTypeFilter,
    }),
  ]);

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
