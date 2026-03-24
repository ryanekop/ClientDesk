import { NextRequest, NextResponse } from "next/server";

import { extractBuiltInExtraFieldValues, extractCustomFieldSnapshots } from "@/lib/form-field-values";
import { requireRouteUser } from "@/lib/pagination/route-user";
import {
  getBookingServiceLabel,
  getBookingServiceNames,
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
  booking_freelance?: Array<{ freelance: FreelancerInfo | null }>;
  booking_freelancers: FreelancerInfo[];
  tracking_uuid: string | null;
  location_detail: string | null;
  extra_fields?: Record<string, unknown> | null;
  booking_services?: unknown[];
  service_selections?: BookingServiceSelection[];
  service_label?: string;
  created_at?: string;
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

export async function GET(request: NextRequest) {
  const { errorResponse, supabase, user } = await requireRouteUser();
  if (errorResponse || !user) {
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

  const [profileResult, bookingsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "studio_name, custom_client_statuses, queue_trigger_status, dp_verify_trigger_status, default_wa_target, form_sections, table_column_preferences",
      )
      .eq("id", user.id)
      .single(),
    supabase
      .from("bookings")
      .select(
        "id, booking_code, client_name, client_whatsapp, booking_date, session_date, status, client_status, queue_position, total_price, dp_paid, dp_verified_amount, dp_verified_at, dp_refund_amount, dp_refunded_at, drive_folder_url, fastpik_project_id, fastpik_project_link, fastpik_project_edit_link, location, location_lat, location_lng, location_detail, notes, event_type, tracking_uuid, extra_fields, created_at, services(id, name, price, is_addon), booking_services(id, kind, sort_order, service:services(id, name, price, is_addon)), freelance(id, name, whatsapp_number), booking_freelance(freelance_id, freelance(id, name, whatsapp_number))",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  if (profileResult.error) {
    return NextResponse.json(
      { error: profileResult.error.message },
      { status: 500 },
    );
  }

  if (bookingsResult.error) {
    return NextResponse.json(
      { error: bookingsResult.error.message },
      { status: 500 },
    );
  }

  const profileData = profileResult.data as {
    studio_name?: string | null;
    custom_client_statuses?: string[] | null;
    queue_trigger_status?: string | null;
    dp_verify_trigger_status?: string | null;
    default_wa_target?: "client" | "freelancer" | null;
    form_sections?: Record<string, unknown> | FormLayoutRow[] | null;
    table_column_preferences?: { bookings?: unknown } | null;
  } | null;
  const statusOptions = getBookingStatusOptions(
    profileData?.custom_client_statuses || DEFAULT_CLIENT_STATUSES,
  );
  const formSectionsByEventType =
    profileData?.form_sections && typeof profileData.form_sections === "object"
      ? profileData.form_sections
      : {};

  const bookings = ((bookingsResult.data || []) as unknown as BookingRow[]).map(
    (booking) => {
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
        statuses: statusOptions,
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
    },
  );

  const packages = Array.from(
    new Set(
      bookings
        .flatMap((booking) =>
          getBookingServiceNames(booking.service_selections || [], "main"),
        )
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right));
  const freelancerNames = Array.from(
    new Set(
      bookings
        .flatMap((booking) =>
          booking.booking_freelancers.map((freelancer) => freelancer.name),
        )
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right));
  const availableEventTypes = Array.from(
    new Set(
      bookings
        .map((booking) => booking.event_type)
        .filter((eventType): eventType is string => Boolean(eventType)),
    ),
  ).sort((left, right) => left.localeCompare(right));

  const filteredBookings = bookings
    .filter((booking) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        booking.client_name.toLowerCase().includes(query) ||
        booking.booking_code.toLowerCase().includes(query) ||
        (booking.location && booking.location.toLowerCase().includes(query));
      const matchesStatus =
        statusFilter === "All" || booking.status === statusFilter;
      const matchesPackage =
        packageFilter === "All" ||
        getBookingServiceNames(
          booking.service_selections || [],
          "main",
        ).includes(packageFilter);
      const matchesFreelance =
        freelanceFilter === "All" ||
        booking.booking_freelancers.some(
          (freelancer) => freelancer.name === freelanceFilter,
        );
      const sessionDateValue = booking.session_date
        ? booking.session_date.slice(0, 10)
        : "";
      const matchesDateFrom =
        !dateFromFilter || (sessionDateValue && sessionDateValue >= dateFromFilter);
      const matchesDateTo =
        !dateToFilter || (sessionDateValue && sessionDateValue <= dateToFilter);
      const matchesEventType =
        eventTypeFilter === "All" || booking.event_type === eventTypeFilter;
      const builtInExtraFields = extractBuiltInExtraFieldValues(
        booking.extra_fields,
      );
      const customFieldMap = Object.fromEntries(
        extractCustomFieldSnapshots(booking.extra_fields).map((item) => [
          item.id,
          item.value,
        ]),
      ) as Record<string, string>;
      const matchesExtraFields = Object.entries(extraFieldFilters).every(
        ([fieldKey, filterValue]) => {
          const normalizedFilter = filterValue.trim();
          if (!normalizedFilter) return true;
          const sourceValue = (
            builtInExtraFields[fieldKey] ||
            customFieldMap[fieldKey] ||
            ""
          ).trim();
          if (!sourceValue) return false;

          return sourceValue
            .toLowerCase()
            .includes(normalizedFilter.toLowerCase());
        },
      );

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPackage &&
        matchesFreelance &&
        matchesDateFrom &&
        matchesDateTo &&
        matchesEventType &&
        matchesExtraFields
      );
    })
    .sort((left, right) => {
      if (sortOrder === "booking_newest") {
        const dateComparison = (right.booking_date || right.created_at || "")
          .localeCompare(left.booking_date || left.created_at || "");
        if (dateComparison !== 0) return dateComparison;
        return (right.created_at || "").localeCompare(left.created_at || "");
      }

      if (sortOrder === "booking_oldest") {
        const dateComparison = (left.booking_date || left.created_at || "")
          .localeCompare(right.booking_date || right.created_at || "");
        if (dateComparison !== 0) return dateComparison;
        return (left.created_at || "").localeCompare(right.created_at || "");
      }

      if (sortOrder === "session_newest") {
        return (left.session_date || "").localeCompare(right.session_date || "");
      }

      return (right.session_date || "").localeCompare(left.session_date || "");
    });

  const start = (page - 1) * perPage;
  const items = exportAll
    ? filteredBookings
    : filteredBookings.slice(start, start + perPage);

  return NextResponse.json({
    items,
    totalItems: filteredBookings.length,
    metadata: {
      studioName: profileData?.studio_name || "",
      statusOptions,
      queueTriggerStatus: profileData?.queue_trigger_status || "Antrian Edit",
      dpVerifyTriggerStatus: profileData?.dp_verify_trigger_status || "",
      defaultWaTarget: profileData?.default_wa_target || "client",
      packages,
      freelancerNames,
      availableEventTypes,
      formSectionsByEventType,
      tableColumnPreferences:
        profileData?.table_column_preferences?.bookings || null,
      metadataRows: bookings.map((booking) => ({
        event_type: booking.event_type,
        extra_fields: booking.extra_fields || null,
      })),
      extraFieldRows:
        eventTypeFilter === "All"
          ? []
          : bookings
              .filter((booking) => booking.event_type === eventTypeFilter)
              .map((booking) => ({
                event_type: booking.event_type,
                extra_fields: booking.extra_fields || null,
              })),
    },
  });
}

type FormLayoutRow = Record<string, unknown>;
