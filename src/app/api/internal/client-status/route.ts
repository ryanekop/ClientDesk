import { NextRequest, NextResponse } from "next/server";

import { requireRouteUser } from "@/lib/pagination/route-user";
import {
  DEFAULT_CLIENT_STATUSES,
  getBookingStatusOptions,
  resolveUnifiedBookingStatus,
} from "@/lib/client-status";
import {
  getBookingServiceLabel,
  normalizeBookingServiceSelections,
  normalizeLegacyServiceRecord,
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

function escapePostgrestLike(value: string) {
  return value.replaceAll("%", "\\%").replaceAll(",", "\\,");
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
  const statusFilter = searchParams.get("status")?.trim() || "";
  const start = (page - 1) * perPage;
  const end = start + perPage - 1;

  const profileResult = await supabase
    .from("profiles")
    .select(
      "custom_client_statuses, queue_trigger_status, dp_verify_trigger_status, table_column_preferences, form_sections",
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
    queue_trigger_status?: string | null;
    dp_verify_trigger_status?: string | null;
    table_column_preferences?: { client_status?: unknown } | null;
    form_sections?: Record<string, unknown> | null;
  } | null;

  const statusOptions = getBookingStatusOptions(
    profileData?.custom_client_statuses || DEFAULT_CLIENT_STATUSES,
  );

  let listQuery = supabase
    .from("bookings")
    .select(
      "id, booking_code, client_name, client_whatsapp, session_date, status, client_status, queue_position, dp_paid, dp_verified_amount, dp_verified_at, dp_refund_amount, dp_refunded_at, tracking_uuid, event_type, extra_fields, services(id, name, price, is_addon), booking_services(id, kind, sort_order, service:services(id, name, price, is_addon))",
      { count: "exact" },
    )
    .eq("user_id", user.id)
    .neq("status", "Batal")
    .order("created_at", { ascending: false });

  if (searchQuery) {
    const escaped = escapePostgrestLike(searchQuery);
    listQuery = listQuery.or(
      `client_name.ilike.%${escaped}%,booking_code.ilike.%${escaped}%`,
    );
  }

  if (statusFilter) {
    listQuery = listQuery.or(
      `status.eq.${statusFilter},client_status.eq.${statusFilter}`,
    );
  }

  const [listResult, metadataRowsResult] = await Promise.all([
    listQuery.range(start, end),
    supabase
      .from("bookings")
      .select("event_type, extra_fields")
      .eq("user_id", user.id)
      .neq("status", "Batal"),
  ]);

  if (listResult.error) {
    return NextResponse.json(
      { error: listResult.error.message },
      { status: 500 },
    );
  }

  if (metadataRowsResult.error) {
    return NextResponse.json(
      { error: metadataRowsResult.error.message },
      { status: 500 },
    );
  }

  const items = ((listResult.data || []) as Array<Record<string, unknown>>).map(
    (booking) => {
      const legacyService = normalizeLegacyServiceRecord(booking.services);
      const serviceSelections = normalizeBookingServiceSelections(
        booking.booking_services,
        booking.services,
      );
      const syncedStatus = resolveUnifiedBookingStatus({
        status:
          typeof booking.status === "string" ? booking.status : undefined,
        clientStatus:
          typeof booking.client_status === "string"
            ? booking.client_status
            : undefined,
        statuses: statusOptions,
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
    },
  );

  return NextResponse.json({
    items,
    totalItems: listResult.count || 0,
    metadata: {
      clientStatuses: statusOptions,
      queueTriggerStatus: profileData?.queue_trigger_status || "Antrian Edit",
      dpVerifyTriggerStatus: profileData?.dp_verify_trigger_status || "",
      tableColumnPreferences:
        profileData?.table_column_preferences?.client_status || null,
      formSectionsByEventType:
        profileData?.form_sections && typeof profileData.form_sections === "object"
          ? profileData.form_sections
          : {},
      metadataRows: metadataRowsResult.data || [],
    },
  });
}
