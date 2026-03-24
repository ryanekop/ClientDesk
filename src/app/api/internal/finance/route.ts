import { NextRequest, NextResponse } from "next/server";

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
import {
  getFinalInvoiceTotal,
  getNetVerifiedRevenueAmount,
  getRemainingFinalPayment,
  getVerifiedDpAmount,
} from "@/lib/final-settlement";

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

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
}

function isSameLocalMonth(dateValue: string | null, referenceDate: Date) {
  if (!dateValue) return false;
  const parsedDate = new Date(dateValue);
  if (Number.isNaN(parsedDate.getTime())) return false;
  return (
    parsedDate.getFullYear() === referenceDate.getFullYear() &&
    parsedDate.getMonth() === referenceDate.getMonth()
  );
}

function isCancelledBooking(booking: BookingFinance) {
  return (booking.status || booking.client_status || "").trim().toLowerCase() === "batal";
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
  const filter = searchParams.get("filter")?.trim() || "all";
  const searchQuery = searchParams.get("search")?.trim() || "";
  const packageFilter = searchParams.get("package")?.trim() || "All";
  const bookingStatusFilter = searchParams.get("bookingStatus")?.trim() || "All";
  const exportAll = searchParams.get("export") === "1";

  const [bookingsResult, profileResult] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id, booking_code, client_name, client_whatsapp, total_price, dp_paid, dp_verified_amount, dp_verified_at, dp_refund_amount, dp_refunded_at, is_fully_paid, status, session_date, event_type, location, location_lat, location_lng, tracking_uuid, client_status, settlement_status, final_adjustments, final_payment_amount, final_paid_at, final_invoice_sent_at, payment_proof_url, payment_proof_drive_file_id, final_payment_proof_url, final_payment_proof_drive_file_id, extra_fields, services(id, name, price, is_addon), booking_services(id, kind, sort_order, service:services(id, name, price, is_addon))",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select(
        "studio_name, table_column_preferences, form_sections, custom_client_statuses",
      )
      .eq("id", user.id)
      .single(),
  ]);

  if (bookingsResult.error) {
    return NextResponse.json(
      { error: bookingsResult.error.message },
      { status: 500 },
    );
  }

  if (profileResult.error) {
    return NextResponse.json(
      { error: profileResult.error.message },
      { status: 500 },
    );
  }

  const bookingStatusOptions = getBookingStatusOptions(
    profileResult.data?.custom_client_statuses || DEFAULT_CLIENT_STATUSES,
  );

  const bookings = ((bookingsResult.data || []) as unknown as BookingFinance[]).map((booking) => {
    const legacyService = normalizeLegacyServiceRecord(booking.services);
    const serviceSelections = normalizeBookingServiceSelections(
      booking.booking_services,
      booking.services,
    );
    const unifiedStatus = resolveUnifiedBookingStatus({
      status: booking.status,
      clientStatus: booking.client_status,
      statuses: bookingStatusOptions,
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

  const packageOptions = Array.from(
    new Set(
      bookings
        .flatMap((booking) =>
          getBookingServiceNames(booking.service_selections || [], "main"),
        )
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right));

  const getUnifiedBookingStatus = (booking: BookingFinance) =>
    resolveUnifiedBookingStatus({
      status: booking.status,
      clientStatus: booking.client_status,
      statuses: bookingStatusOptions,
    });

  const filtered = (filter === "all"
    ? bookings
    : filter === "paid"
        ? bookings.filter((booking) => !isCancelledBooking(booking) && booking.is_fully_paid)
        : bookings.filter((booking) => !isCancelledBooking(booking) && !booking.is_fully_paid)
  ).filter((booking) => {
    const query = searchQuery.trim().toLowerCase();
    const packageNames = getBookingServiceNames(booking.service_selections || [], "main");
    const unifiedStatus = getUnifiedBookingStatus(booking);

    const matchesSearch =
      !query ||
      booking.client_name.toLowerCase().includes(query) ||
      booking.booking_code.toLowerCase().includes(query) ||
      (booking.location || "").toLowerCase().includes(query) ||
      (booking.service_label || booking.services?.name || "").toLowerCase().includes(query) ||
      packageNames.some((name) => name.toLowerCase().includes(query));
    const matchesPackage = packageFilter === "All" || packageNames.includes(packageFilter);
    const matchesBookingStatus =
      bookingStatusFilter === "All" || unifiedStatus === bookingStatusFilter;

    return matchesSearch && matchesPackage && matchesBookingStatus;
  });

  const totalRevenue = bookings.reduce(
    (sum, booking) =>
      sum +
      getNetVerifiedRevenueAmount({
        total_price: booking.total_price,
        dp_paid: booking.dp_paid,
        dp_verified_amount: booking.dp_verified_amount,
        dp_verified_at: booking.dp_verified_at,
        dp_refund_amount: booking.dp_refund_amount,
        dp_refunded_at: booking.dp_refunded_at,
        final_adjustments: booking.final_adjustments,
        final_payment_amount: booking.final_payment_amount,
        final_paid_at: booking.final_paid_at,
        settlement_status: booking.settlement_status,
        is_fully_paid: booking.is_fully_paid,
      }),
    0,
  );
  const totalPending = bookings
    .filter((booking) => !isCancelledBooking(booking) && !booking.is_fully_paid)
    .reduce(
      (sum, booking) =>
        sum +
        getRemainingFinalPayment({
          total_price: booking.total_price,
          dp_paid: booking.dp_paid,
          final_adjustments: booking.final_adjustments,
          final_payment_amount: booking.final_payment_amount,
          final_paid_at: booking.final_paid_at,
          settlement_status: booking.settlement_status,
          is_fully_paid: booking.is_fully_paid,
        }),
      0,
    );
  const totalDP = bookings.reduce(
    (sum, booking) =>
      sum +
      getVerifiedDpAmount({
        total_price: booking.total_price,
        dp_paid: booking.dp_paid,
        dp_verified_amount: booking.dp_verified_amount,
      }),
    0,
  );
  const now = new Date();
  const monthlyRevenueTotal = bookings.reduce((sum, booking) => {
    const verifiedDp = isSameLocalMonth(booking.dp_verified_at, now)
      ? Math.max(booking.dp_verified_amount || 0, 0)
      : 0;
    const verifiedFinalPayment = isSameLocalMonth(booking.final_paid_at, now)
      ? Math.max(booking.final_payment_amount || 0, 0)
      : 0;
    const refundedDp = isSameLocalMonth(booking.dp_refunded_at, now)
      ? Math.min(
          Math.max(booking.dp_refund_amount || 0, 0),
          Math.max(booking.dp_verified_amount || 0, 0),
        )
      : 0;
    return sum + verifiedDp + verifiedFinalPayment - refundedDp;
  }, 0);

  const items = exportAll
    ? filtered
    : filtered.slice((page - 1) * perPage, (page - 1) * perPage + perPage);

  return NextResponse.json({
    items,
    totalItems: filtered.length,
    metadata: {
      studioName: profileResult.data?.studio_name || "",
      bookingStatusOptions,
      packageOptions,
      tableColumnPreferences:
        profileResult.data?.table_column_preferences?.finance || null,
      formSectionsByEventType:
        profileResult.data?.form_sections && typeof profileResult.data.form_sections === "object"
          ? profileResult.data.form_sections
          : {},
      metadataRows: bookings.map((booking) => ({
        event_type: booking.event_type,
        extra_fields: booking.extra_fields || null,
      })),
      summary: {
        totalRevenue,
        totalPending,
        totalDP,
        totalBookings: bookings.length,
        paidCount: bookings.filter((booking) => !isCancelledBooking(booking) && booking.is_fully_paid).length,
        unpaidCount: bookings.filter((booking) => !isCancelledBooking(booking) && !booking.is_fully_paid).length,
        monthlyRevenueTotal,
      },
    },
  });
}
