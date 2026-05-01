import { NextRequest, NextResponse } from "next/server";

import { requireRouteUser } from "@/lib/pagination/route-user";
import {
  getBookingServiceLabel,
  normalizeBookingServiceSelections,
  normalizeLegacyServiceRecord,
} from "@/lib/booking-services";
import {
  DEFAULT_CLIENT_STATUSES,
  getBookingStatusOptions,
  resolveUnifiedBookingStatus,
} from "@/lib/client-status";
import { normalizeOperationalCosts } from "@/lib/operational-costs";

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 10;
const MAX_PER_PAGE = 100;
const MAX_FETCH_ROWS = 5000;
const PAYMENT_STATUSES = ["all", "unpaid", "paid"] as const;
const SORT_ORDERS = [
  "booking_newest",
  "booking_oldest",
  "session_newest",
  "session_oldest",
  "payment_unpaid_first",
  "payment_paid_first",
] as const;

type PaymentStatusFilter = (typeof PAYMENT_STATUSES)[number];
type PaymentEntryStatus = "unpaid" | "paid";
type SortOrder = (typeof SORT_ORDERS)[number];
type DateBasis = "booking_date" | "session_date";

type FreelanceRow = {
  id: string;
  name: string;
  role: string | null;
  status: string | null;
  pricelist?: unknown;
};

type BookingRow = {
  id: string;
  booking_code: string;
  client_name: string;
  booking_date: string | null;
  session_date: string | null;
  event_type: string | null;
  status: string | null;
  client_status: string | null;
  operational_costs?: unknown;
  services?: { id?: string; name: string; price?: number; is_addon?: boolean | null } | null;
  booking_services?: unknown[];
};

type PaymentEntryRow = {
  id: string;
  amount: number | null;
  status: PaymentEntryStatus | string | null;
  paid_at: string | null;
  notes: string | null;
  booking_id: string;
  freelance_id: string;
  created_at: string;
  updated_at: string;
  freelance: FreelanceRow | null;
  booking: BookingRow | null;
};

type PaymentDetail = {
  id: string;
  bookingId: string;
  freelanceId: string;
  bookingCode: string;
  clientName: string;
  bookingDate: string | null;
  sessionDate: string | null;
  eventType: string;
  bookingStatus: string;
  serviceLabel: string;
  amount: number;
  status: PaymentEntryStatus;
  paidAt: string | null;
  notes: string;
  freelancePricelist: unknown;
};

type PaymentGroup = {
  freelanceId: string;
  freelanceName: string;
  role: string;
  status: string;
  pricelist: unknown;
  totalJobs: number;
  paidCount: number;
  unpaidCount: number;
  unpaidTotal: number;
  details: PaymentDetail[];
};

type EnrichedPaymentDetail = PaymentDetail & {
  freelanceName: string;
  freelanceRole: string;
  freelanceStatus: string;
  freelancePricelist: unknown;
};

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

function parseFilterList(searchParams: URLSearchParams, key: string) {
  const seen = new Set<string>();
  const values: string[] = [];
  searchParams.getAll(key).forEach((rawValue) => {
    try {
      const parsed = JSON.parse(rawValue) as unknown;
      if (Array.isArray(parsed)) {
        parsed.forEach((item) => {
          if (typeof item !== "string") return;
          const trimmed = item.trim();
          if (!trimmed || trimmed.toLowerCase() === "all" || seen.has(trimmed)) return;
          seen.add(trimmed);
          values.push(trimmed);
        });
        return;
      }
    } catch {
      // Fallback to CSV parsing.
    }

    rawValue.split(",").forEach((item) => {
      const trimmed = item.trim();
      if (!trimmed || trimmed.toLowerCase() === "all" || seen.has(trimmed)) return;
      seen.add(trimmed);
      values.push(trimmed);
    });
  });
  return values;
}

function parsePaymentStatus(value: string | null): PaymentStatusFilter {
  return value && PAYMENT_STATUSES.includes(value as PaymentStatusFilter)
    ? (value as PaymentStatusFilter)
    : "all";
}

function parseSortOrder(value: string | null): SortOrder {
  return value && SORT_ORDERS.includes(value as SortOrder)
    ? (value as SortOrder)
    : "booking_newest";
}

function parseDateBasis(value: string | null): DateBasis {
  return value === "session_date" ? "session_date" : "booking_date";
}

function parseDateValue(value: string | null) {
  const trimmed = value?.trim() || "";
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : "";
}

function normalizeSearchValue(value: string | null) {
  return (value || "").trim().toLowerCase();
}

function dateKey(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function compareNullableDates(left: string | null, right: string | null, ascending: boolean) {
  const leftValue = left ? Date.parse(left) : 0;
  const rightValue = right ? Date.parse(right) : 0;
  if (leftValue === rightValue) return 0;
  return ascending ? leftValue - rightValue : rightValue - leftValue;
}

function getPaymentPriority(status: PaymentEntryStatus, sort: SortOrder) {
  if (sort === "payment_unpaid_first") return status === "unpaid" ? 0 : 1;
  if (sort === "payment_paid_first") return status === "paid" ? 0 : 1;
  return 0;
}

function normalizeEntryStatus(value: unknown): PaymentEntryStatus {
  return value === "paid" ? "paid" : "unpaid";
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function readMaybeSingle<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function normalizeMatchText(value: unknown) {
  return typeof value === "string"
    ? value.trim().toLowerCase().replace(/\s+/g, " ")
    : "";
}

function getMatchedOperationalCostAmount(
  operationalCosts: unknown,
  freelance: Pick<FreelanceRow, "name" | "role"> | null | undefined,
) {
  const name = normalizeMatchText(freelance?.name);
  const role = normalizeMatchText(freelance?.role);
  const needles = [name, role].filter((item) => item.length >= 2);
  if (needles.length === 0) return 0;

  return normalizeOperationalCosts(operationalCosts).reduce((sum, item) => {
    const label = normalizeMatchText(item.label);
    if (!label) return sum;
    return needles.some((needle) => label.includes(needle))
      ? sum + item.amount
      : sum;
  }, 0);
}

async function ensureMissingEntries(
  supabase: Awaited<ReturnType<typeof requireRouteUser>>["supabase"],
  userId: string,
  autofillFromOperationalCosts: boolean,
) {
  const [junctionResult, legacyResult] = await Promise.all([
    supabase
      .from("booking_freelance")
      .select("booking_id, freelance_id, bookings!inner(user_id, operational_costs), freelance(id, name, role)")
      .eq("bookings.user_id", userId)
      .limit(MAX_FETCH_ROWS),
    supabase
      .from("bookings")
      .select("id, freelance_id, operational_costs, freelance(id, name, role)")
      .eq("user_id", userId)
      .not("freelance_id", "is", null)
      .limit(MAX_FETCH_ROWS),
  ]);

  const rows = [
    ...(Array.isArray(junctionResult.data)
      ? junctionResult.data.map((row) => ({
        booking_id: row.booking_id,
        freelance_id: row.freelance_id,
        amount: autofillFromOperationalCosts
          ? getMatchedOperationalCostAmount(
            readMaybeSingle(row.bookings)?.operational_costs,
            readMaybeSingle(row.freelance),
          )
          : 0,
      }))
      : []),
    ...(Array.isArray(legacyResult.data)
      ? legacyResult.data.map((row) => ({
        booking_id: row.id,
        freelance_id: row.freelance_id,
        amount: autofillFromOperationalCosts
          ? getMatchedOperationalCostAmount(
            row.operational_costs,
            readMaybeSingle(row.freelance),
          )
          : 0,
      }))
      : []),
  ];

  if (rows.length === 0) return;

  await supabase
    .from("freelance_payment_entries")
    .upsert(
      rows
        .filter((row) => row.booking_id && row.freelance_id)
        .map((row) => ({
          user_id: userId,
          booking_id: row.booking_id,
          freelance_id: row.freelance_id,
          amount: row.amount,
          status: "unpaid",
        })),
      { onConflict: "booking_id,freelance_id", ignoreDuplicates: true },
    );

  const zeroAmountRows = rows.filter((row) => row.booking_id && row.freelance_id && row.amount > 0);
  await Promise.all(
    zeroAmountRows.map((row) =>
      supabase
        .from("freelance_payment_entries")
        .update({ amount: row.amount })
        .eq("user_id", userId)
        .eq("booking_id", row.booking_id)
        .eq("freelance_id", row.freelance_id)
        .eq("amount", 0)
        .eq("status", "unpaid")
        .is("paid_at", null)
        .is("notes", null),
    ),
  );
}

export async function GET(request: NextRequest) {
  const { errorResponse, supabase, user } = await requireRouteUser();
  if (errorResponse || !user) return errorResponse;

  const { data: autofillProfile } = await supabase
    .from("profiles")
    .select("team_payment_autofill_from_operational_costs")
    .eq("id", user.id)
    .single();
  const autofillFromOperationalCosts =
    autofillProfile?.team_payment_autofill_from_operational_costs !== false;

  await ensureMissingEntries(supabase, user.id, autofillFromOperationalCosts);

  const searchParams = request.nextUrl.searchParams;
  const page = parsePositiveInt(searchParams.get("page"), DEFAULT_PAGE);
  const perPage = Math.min(parsePositiveInt(searchParams.get("perPage"), DEFAULT_PER_PAGE), MAX_PER_PAGE);
  const search = normalizeSearchValue(searchParams.get("search"));
  const paymentStatus = parsePaymentStatus(searchParams.get("paymentStatus"));
  const roleFilters = parseFilterList(searchParams, "roleFilters");
  const bookingStatusFilters = parseFilterList(searchParams, "bookingStatusFilters");
  const eventTypeFilters = parseFilterList(searchParams, "eventTypeFilters");
  const dateFrom = parseDateValue(searchParams.get("dateFrom"));
  const dateTo = parseDateValue(searchParams.get("dateTo"));
  const dateBasis = parseDateBasis(searchParams.get("dateBasis"));
  const sort = parseSortOrder(searchParams.get("sort"));

  const [entryResult, profileResult] = await Promise.all([
    supabase
      .from("freelance_payment_entries")
      .select(`
        id,
        amount,
        status,
        paid_at,
        notes,
        booking_id,
        freelance_id,
        created_at,
        updated_at,
        freelance(id, name, role, status, pricelist),
        booking:booking_id(
          id,
          booking_code,
          client_name,
          booking_date,
          session_date,
          event_type,
          status,
          client_status,
          operational_costs,
          services(id, name, price, is_addon),
          booking_services(*)
        )
      `)
      .eq("user_id", user.id)
      .limit(MAX_FETCH_ROWS),
    supabase
      .from("profiles")
      .select("custom_client_statuses, table_column_preferences")
      .eq("id", user.id)
      .single(),
  ]);

  if (entryResult.error) {
    return NextResponse.json({ error: entryResult.error.message }, { status: 500 });
  }

  const bookingStatusOptions = getBookingStatusOptions(
    readStringArray(profileResult.data?.custom_client_statuses).length > 0
      ? readStringArray(profileResult.data?.custom_client_statuses)
      : DEFAULT_CLIENT_STATUSES,
  );
  const fallbackStatus = bookingStatusOptions[0] || "Pending";

  const details: EnrichedPaymentDetail[] = ((entryResult.data || []) as unknown as Array<
    Omit<PaymentEntryRow, "booking" | "freelance"> & {
      booking: BookingRow | BookingRow[] | null;
      freelance: FreelanceRow | FreelanceRow[] | null;
    }
  >)
    .flatMap((entry) => {
      const booking = readMaybeSingle(entry.booking);
      const freelance = readMaybeSingle(entry.freelance);
      if (!booking || !freelance) return [];

      const serviceSelections = normalizeBookingServiceSelections(
        booking.booking_services,
        booking.services || null,
      );
      const legacyService = normalizeLegacyServiceRecord(booking.services || null);
      const bookingStatus = resolveUnifiedBookingStatus({
        status: booking.status,
        clientStatus: booking.client_status,
        statuses: bookingStatusOptions,
      }) || fallbackStatus;

      return [{
        id: entry.id,
        bookingId: booking.id,
        freelanceId: freelance.id,
        bookingCode: booking.booking_code || "-",
        clientName: booking.client_name || "-",
        bookingDate: booking.booking_date,
        sessionDate: booking.session_date,
        eventType: booking.event_type || "-",
        bookingStatus,
        serviceLabel: getBookingServiceLabel(serviceSelections, {
          kind: "main",
          fallback: legacyService?.name || "-",
        }),
        amount: Math.max(Number(entry.amount) || 0, 0),
        status: normalizeEntryStatus(entry.status),
        paidAt: entry.paid_at,
        notes: entry.notes || "",
        freelancePricelist: freelance.pricelist ?? null,
        freelanceName: freelance.name || "-",
        freelanceRole: freelance.role || "-",
        freelanceStatus: freelance.status || "",
      }];
    });

  const metadataSource = details;
  const roleOptions = Array.from(new Set(metadataSource.map((item) => item.freelanceRole).filter((item) => item && item !== "-")))
    .sort((left, right) => left.localeCompare(right));
  const eventTypeOptions = Array.from(new Set(metadataSource.map((item) => item.eventType).filter((item) => item && item !== "-")))
    .sort((left, right) => left.localeCompare(right));
  const resolvedBookingStatusOptions = Array.from(new Set([...bookingStatusOptions, ...metadataSource.map((item) => item.bookingStatus)]))
    .filter(Boolean);

  const filteredDetails = details
    .filter((item) => paymentStatus === "all" || item.status === paymentStatus)
    .filter((item) => roleFilters.length === 0 || roleFilters.includes(item.freelanceRole))
    .filter((item) => eventTypeFilters.length === 0 || eventTypeFilters.includes(item.eventType))
    .filter((item) => bookingStatusFilters.length === 0 || bookingStatusFilters.includes(item.bookingStatus))
    .filter((item) => {
      const basisValue = dateBasis === "session_date" ? item.sessionDate : item.bookingDate;
      const value = dateKey(basisValue);
      if (dateFrom && (!value || value < dateFrom)) return false;
      if (dateTo && (!value || value > dateTo)) return false;
      return true;
    })
    .filter((item) => {
      if (!search) return true;
      return [
        item.freelanceName,
        item.freelanceRole,
        item.bookingCode,
        item.clientName,
      ].some((value) => value.toLowerCase().includes(search));
    })
    .sort((left, right) => {
      if (sort === "payment_unpaid_first" || sort === "payment_paid_first") {
        const statusCompare = getPaymentPriority(left.status, sort) - getPaymentPriority(right.status, sort);
        if (statusCompare !== 0) return statusCompare;
        const dateCompare = compareNullableDates(left.bookingDate, right.bookingDate, false);
        if (dateCompare !== 0) return dateCompare;
        return left.freelanceName.localeCompare(right.freelanceName);
      }
      const ascending = sort.endsWith("oldest");
      const basis = sort.startsWith("session") ? "sessionDate" : "bookingDate";
      const dateCompare = compareNullableDates(left[basis], right[basis], ascending);
      if (dateCompare !== 0) return dateCompare;
      return left.freelanceName.localeCompare(right.freelanceName);
    });

  const groupMap = new Map<string, PaymentGroup>();
  filteredDetails.forEach((item) => {
    const group = groupMap.get(item.freelanceId) || {
      freelanceId: item.freelanceId,
      freelanceName: item.freelanceName,
      role: item.freelanceRole,
      status: item.freelanceStatus,
      pricelist: item.freelancePricelist,
      totalJobs: 0,
      paidCount: 0,
      unpaidCount: 0,
      unpaidTotal: 0,
      details: [],
    };

    group.details.push({
      id: item.id,
      bookingId: item.bookingId,
      freelanceId: item.freelanceId,
      bookingCode: item.bookingCode,
      clientName: item.clientName,
      bookingDate: item.bookingDate,
      sessionDate: item.sessionDate,
      eventType: item.eventType,
      bookingStatus: item.bookingStatus,
      serviceLabel: item.serviceLabel,
      amount: item.amount,
      status: item.status,
      paidAt: item.paidAt,
      notes: item.notes,
      freelancePricelist: item.freelancePricelist,
    });
    group.totalJobs += 1;
    if (item.status === "paid") {
      group.paidCount += 1;
    } else {
      group.unpaidCount += 1;
      group.unpaidTotal += item.amount;
    }
    groupMap.set(item.freelanceId, group);
  });

  const groups = Array.from(groupMap.values()).sort((left, right) => {
    if (sort === "payment_unpaid_first") {
      const leftHasPriority = left.unpaidCount > 0 ? 0 : 1;
      const rightHasPriority = right.unpaidCount > 0 ? 0 : 1;
      if (leftHasPriority !== rightHasPriority) return leftHasPriority - rightHasPriority;
    }
    if (sort === "payment_paid_first") {
      const leftHasPriority = left.paidCount > 0 ? 0 : 1;
      const rightHasPriority = right.paidCount > 0 ? 0 : 1;
      if (leftHasPriority !== rightHasPriority) return leftHasPriority - rightHasPriority;
    }
    if (right.unpaidTotal !== left.unpaidTotal) return right.unpaidTotal - left.unpaidTotal;
    if (right.unpaidCount !== left.unpaidCount) return right.unpaidCount - left.unpaidCount;
    return left.freelanceName.localeCompare(right.freelanceName);
  });
  const start = (page - 1) * perPage;
  const pagedGroups = groups.slice(start, start + perPage);

  return NextResponse.json({
    items: pagedGroups,
    totalItems: groups.length,
    metadata: {
      roles: roleOptions,
      bookingStatuses: resolvedBookingStatusOptions,
      eventTypes: eventTypeOptions,
      tableColumnPreferences:
        profileResult.data?.table_column_preferences &&
        typeof profileResult.data.table_column_preferences === "object" &&
        !Array.isArray(profileResult.data.table_column_preferences)
          ? (profileResult.data.table_column_preferences as { team_payments?: unknown }).team_payments ?? null
          : null,
      summary: {
        totalGroups: groups.length,
        totalJobs: filteredDetails.length,
        paidCount: filteredDetails.filter((item) => item.status === "paid").length,
        unpaidCount: filteredDetails.filter((item) => item.status !== "paid").length,
        unpaidTotal: filteredDetails
          .filter((item) => item.status !== "paid")
          .reduce((sum, item) => sum + item.amount, 0),
      },
    },
  });
}

function normalizeIds(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function normalizeAmount(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(Math.floor(parsed), 0) : null;
}

export async function PATCH(request: NextRequest) {
  const { errorResponse, supabase, user } = await requireRouteUser();
  if (errorResponse || !user) return errorResponse;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const ids = normalizeIds(body.ids ?? (body.id ? [body.id] : []));
  if (ids.length === 0) {
    return NextResponse.json({ error: "No payment entries selected" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.status === "paid") {
    patch.status = "paid";
    patch.paid_at = new Date().toISOString();
  } else if (body.status === "unpaid") {
    patch.status = "unpaid";
    patch.paid_at = null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "amount")) {
    const amount = normalizeAmount(body.amount);
    if (amount === null) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    patch.amount = amount;
  }

  if (Object.prototype.hasOwnProperty.call(body, "notes")) {
    patch.notes = typeof body.notes === "string" && body.notes.trim().length > 0
      ? body.notes.trim()
      : null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  const { error } = await supabase
    .from("freelance_payment_entries")
    .update(patch)
    .eq("user_id", user.id)
    .in("id", ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
