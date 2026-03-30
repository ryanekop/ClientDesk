import { NextRequest, NextResponse } from "next/server";
import {
  assertBookingWriteAccessForUser,
  BookingWriteAccessDeniedError,
} from "@/lib/booking-write-access.server";
import { apiT, apiText } from "@/lib/i18n/api-errors";
import { resolveApiLocale, type AppLocale } from "@/lib/i18n/api-locale";
import { resolvePublicOrigin } from "@/lib/auth/public-origin";
import { createClient } from "@/utils/supabase/server";
import {
  buildCommitReportFile,
  buildImportedBookingExtraFields,
  loadImportContext,
  resolveImportedLocation,
  validateImportWorkbook,
} from "@/lib/bookings-import/core";
import type {
  ImportCommitRowResult,
  ImportSyncSummary,
  NormalizedImportRow,
} from "@/lib/bookings-import/types";
import {
  createBookingCode,
  isDuplicateBookingCodeError,
} from "@/lib/booking-code";
import { syncBookingCalendarEvent } from "@/lib/google-calendar-booking";
import { resolveBookingFreelancerNames } from "@/lib/booking-freelancers";
import { hasOAuthTokenPair } from "@/utils/google/connection";
import { fetchGoogleCalendarProfileSchemaSafe } from "@/app/api/google/_lib/calendar-profile";
import { resolveBookingFreelancerAttendeeEmails } from "@/lib/google-calendar-attendees";
import {
  getGoogleCalendarSyncErrorMessage,
  isNoScheduleSyncError,
  updateBookingCalendarSyncState,
} from "@/lib/google-calendar-sync";
import { buildBookingDetailLink } from "@/lib/booking-detail-link";

export const runtime = "nodejs";

type InsertedBooking = {
  id: string;
  bookingCode: string;
  rowNumber: number;
  externalImportId: string;
};

async function insertOneBooking(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  row: NormalizedImportRow,
): Promise<InsertedBooking> {
  const extraFields = buildImportedBookingExtraFields(row);
  const resolvedLocation = resolveImportedLocation(row);

  const bookingPayload: Record<string, unknown> = {
    user_id: userId,
    external_import_id: row.externalImportId,
    client_name: row.clientName,
    event_type: row.eventType,
    client_whatsapp: null,
    instagram: null,
    session_date: row.sessionDate,
    location: resolvedLocation.location,
    location_lat: resolvedLocation.locationLat,
    location_lng: resolvedLocation.locationLng,
    location_detail: row.locationDetail,
    service_id: row.mainServiceIds[0] || null,
    freelance_id: row.freelancerIds[0] || null,
    total_price: row.totalPrice,
    dp_paid: row.dpPaid,
    is_fully_paid: row.dpPaid >= row.totalPrice,
    status: row.status,
    client_status: row.status,
    notes: row.notes,
    admin_notes: row.adminNotes,
    extra_fields: extraFields,
  };
  if (row.bookingDate) {
    bookingPayload.booking_date = row.bookingDate;
  }

  let bookingRow: { id: string; booking_code: string } | null = null;
  let insertError: { message?: string | null } | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await supabase
      .from("bookings")
      .insert({
        ...bookingPayload,
        booking_code: createBookingCode(),
      })
      .select("id, booking_code")
      .single();

    if (!error && data) {
      bookingRow = data;
      insertError = null;
      break;
    }

    insertError = error;
    if (isDuplicateBookingCodeError(error)) {
      continue;
    }
    break;
  }

  if (!bookingRow) {
    throw new Error(insertError?.message || "failedSaveBooking");
  }

  const bookingServiceRows = [
    ...row.mainServiceIds.map((serviceId, index) => ({
      booking_id: bookingRow.id,
      service_id: serviceId,
      kind: "main" as const,
      sort_order: index,
    })),
    ...row.addonServiceIds.map((serviceId, index) => ({
      booking_id: bookingRow.id,
      service_id: serviceId,
      kind: "addon" as const,
      sort_order: index,
    })),
  ];

  if (bookingServiceRows.length > 0) {
    const { error } = await supabase
      .from("booking_services")
      .insert(bookingServiceRows);
    if (error) {
      await supabase.from("bookings").delete().eq("id", bookingRow.id);
      throw new Error(error.message || "failedSaveBookingServices");
    }
  }

  if (row.freelancerIds.length > 0) {
    const { error } = await supabase
      .from("booking_freelance")
      .insert(
        row.freelancerIds.map((freelanceId) => ({
          booking_id: bookingRow.id,
          freelance_id: freelanceId,
        })),
      );
    if (error) {
      await supabase.from("bookings").delete().eq("id", bookingRow.id);
      throw new Error(error.message || "failedSaveFreelanceAssignments");
    }
  }

  return {
    id: bookingRow.id,
    bookingCode: bookingRow.booking_code,
    rowNumber: row.rowNumber,
    externalImportId: row.externalImportId,
  };
}

async function syncImportedBookings(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  bookingIds: string[],
  locale: AppLocale,
  publicOrigin: string,
): Promise<ImportSyncSummary> {
  const fallback: ImportSyncSummary = {
    successCount: 0,
    failedCount: 0,
    skippedCount: 0,
    errors: [],
    skipped: [],
  };

  if (bookingIds.length === 0) return fallback;

  const profileResult = await fetchGoogleCalendarProfileSchemaSafe(supabase, userId);
  if (profileResult.error) {
    const message = apiT(locale, "failedLoadCalendarProfile");
    await Promise.allSettled(
      bookingIds.map((bookingId) =>
        updateBookingCalendarSyncState({
          supabase,
          bookingId,
          userId,
          status: "failed",
          errorMessage: message,
        }),
      ),
    );

    return {
      ...fallback,
      failedCount: bookingIds.length,
      errors: [message],
    };
  }

  const profile = profileResult.data;
  const accessToken =
    typeof profile?.google_access_token === "string"
      ? profile.google_access_token.trim()
      : "";
  const refreshToken =
    typeof profile?.google_refresh_token === "string"
      ? profile.google_refresh_token.trim()
      : "";

  if (!hasOAuthTokenPair(accessToken, refreshToken)) {
    const message = apiT(locale, "incompleteCalendarConnection");
    await Promise.allSettled(
      bookingIds.map((bookingId) =>
        updateBookingCalendarSyncState({
          supabase,
          bookingId,
          userId,
          status: "failed",
          errorMessage: message,
        }),
      ),
    );

    return {
      ...fallback,
      failedCount: bookingIds.length,
      errors: [message],
    };
  }

  const { data: bookings } = await supabase
    .from("bookings")
    .select(
      "id, booking_code, client_name, client_whatsapp, session_date, location, location_lat, location_lng, location_detail, notes, event_type, extra_fields, google_calendar_event_id, google_calendar_event_ids, services(id, name, duration_minutes, is_addon, affects_schedule), booking_services(id, kind, sort_order, service:services(id, name, duration_minutes, is_addon, affects_schedule)), freelance(name), booking_freelance(freelance(name))",
    )
    .eq("user_id", userId)
    .in("id", bookingIds);

  const bookingRows = (bookings || []) as Array<{
    id: string;
    booking_code: string;
    client_name: string;
    client_whatsapp: string | null;
    session_date: string | null;
    location: string | null;
    location_lat: number | null;
    location_lng: number | null;
    location_detail: string | null;
    notes: string | null;
    event_type: string | null;
    extra_fields: unknown;
    google_calendar_event_id?: string | null;
    google_calendar_event_ids?: unknown;
    services?: unknown;
    booking_services?: unknown;
    freelance?: unknown;
    booking_freelance?: unknown;
  }>;

  let attendeeEmailsByBooking: Record<string, string[]> = {};
  try {
    attendeeEmailsByBooking = await resolveBookingFreelancerAttendeeEmails({
      supabase,
      userId,
      bookingIds: bookingRows.map((booking) => booking.id),
    });
  } catch (error) {
    const message = getGoogleCalendarSyncErrorMessage(
      error,
      apiT(locale, "failedLoadFreelanceAssignments"),
    );

    await Promise.allSettled(
      bookingIds.map((bookingId) =>
        updateBookingCalendarSyncState({
          supabase,
          bookingId,
          userId,
          status: "failed",
          errorMessage: message,
        }),
      ),
    );

    return {
      ...fallback,
      failedCount: bookingIds.length,
      errors: [message],
    };
  }

  let successCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];
  const skipped: string[] = [];

  for (const booking of bookingRows) {
    try {
      const syncedEvent = await syncBookingCalendarEvent({
        profile: {
          accessToken,
          refreshToken,
          studioName: profile?.studio_name ?? null,
          eventFormat: profile?.calendar_event_format ?? null,
          eventFormatMap: profile?.calendar_event_format_map ?? null,
          eventDescription: profile?.calendar_event_description ?? null,
          eventDescriptionMap: profile?.calendar_event_description_map ?? null,
        },
        booking: {
          id: booking.id,
          bookingCode: booking.booking_code,
          bookingDetailLink: buildBookingDetailLink({
            publicOrigin,
            locale,
            bookingId: booking.id,
          }),
          clientName: booking.client_name,
          clientWhatsapp: booking.client_whatsapp,
          sessionDate: booking.session_date,
          location: booking.location,
          locationLat: booking.location_lat,
          locationLng: booking.location_lng,
          locationDetail: booking.location_detail,
          eventType: booking.event_type,
          notes: booking.notes,
          extraFields: booking.extra_fields,
          freelancerNames: resolveBookingFreelancerNames({
            bookingFreelance: booking.booking_freelance,
            legacyFreelance: booking.freelance,
          }),
          googleCalendarEventId: booking.google_calendar_event_id,
          googleCalendarEventIds: booking.google_calendar_event_ids,
          services: booking.services,
          bookingServices: booking.booking_services,
        },
        attendeeEmails: attendeeEmailsByBooking[booking.id] || [],
      });

      await updateBookingCalendarSyncState({
        supabase,
        bookingId: booking.id,
        userId,
        status: "success",
        eventId: syncedEvent.eventId,
        eventIds: syncedEvent.eventIds,
      });
      successCount += 1;
    } catch (error) {
      const message = getGoogleCalendarSyncErrorMessage(error, "Unknown error");
      if (isNoScheduleSyncError(error)) {
        skippedCount += 1;
        skipped.push(`${booking.booking_code}: ${message}`);
        await updateBookingCalendarSyncState({
          supabase,
          bookingId: booking.id,
          userId,
          status: "skipped",
          errorMessage: message,
        });
        continue;
      }

      failedCount += 1;
      errors.push(`${booking.booking_code}: ${message}`);
      await updateBookingCalendarSyncState({
        supabase,
        bookingId: booking.id,
        userId,
        status: "failed",
        errorMessage: message,
      });
    }
  }

  return {
    successCount,
    failedCount,
    skippedCount,
    errors,
    skipped,
  };
}

export async function POST(request: NextRequest) {
  try {
    const locale = resolveApiLocale(request);
    const publicOrigin = resolvePublicOrigin(request);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: apiText(request, "unauthorized") },
        { status: 401 },
      );
    }

    await assertBookingWriteAccessForUser(user.id);

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: apiText(request, "xlsxRequired") },
        { status: 400 },
      );
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json(
        { success: false, error: apiText(request, "invalidXlsxFormat") },
        { status: 400 },
      );
    }

    const { context, error } = await loadImportContext(supabase, user.id);
    if (!context || error) {
      return NextResponse.json(
        { success: false, error: error || apiText(request, "failedLoadImportContext") },
        { status: 500 },
      );
    }

    const buffer = await file.arrayBuffer();
    const validation = await validateImportWorkbook(
      supabase,
      user.id,
      context,
      buffer,
      { fileNamePrefix: "import_commit_validation_report" },
    );

    if (!validation.canCommit || validation.summary.errorRows > 0) {
      return NextResponse.json(
        {
          success: false,
          error: apiText(request, "commitCancelledValidation"),
          canCommit: false,
          summary: validation.summary,
          previewRows: validation.previewRows,
          report: validation.report,
        },
        { status: 400 },
      );
    }

    const inserted: InsertedBooking[] = [];
    let runtimeError: string | null = null;

    for (const row of validation.normalizedRows) {
      try {
        const created = await insertOneBooking(supabase, user.id, row);
        inserted.push(created);
      } catch (error) {
        const rawError = error instanceof Error ? error.message : "";
        if (rawError === "failedSaveBooking") {
          runtimeError = apiText(request, "failedSaveBooking");
        } else if (rawError === "failedSaveBookingServices") {
          runtimeError = apiText(request, "failedSaveBookingServices");
        } else if (rawError === "failedSaveFreelanceAssignments") {
          runtimeError = apiText(request, "failedSaveFreelanceAssignments");
        } else if (rawError) {
          runtimeError = rawError;
        } else {
          runtimeError = apiText(request, "failedSaveBooking");
        }
        break;
      }
    }

    if (runtimeError) {
      if (inserted.length > 0) {
        const rollbackIds = inserted.map((item) => item.id);
        await supabase.from("bookings").delete().in("id", rollbackIds);
      }

      const rolledBackRows: ImportCommitRowResult[] = validation.normalizedRows.map((row) => ({
        rowNumber: row.rowNumber,
        externalImportId: row.externalImportId,
        status: "failed",
        error: apiText(request, "importCancelledRuntime", { reason: runtimeError }),
      }));

      const report = buildCommitReportFile(
        "import_commit_report_failed.xlsx",
        validation.previewRows,
        rolledBackRows,
      );

      return NextResponse.json(
        {
          success: false,
          error: runtimeError,
          rolledBack: true,
          summary: {
            totalRows: validation.summary.totalRows,
            importedRows: 0,
            failedRows: validation.summary.totalRows,
          },
          commitRows: rolledBackRows,
          report,
        },
        { status: 409 },
      );
    }

    const commitRows: ImportCommitRowResult[] = inserted.map((item) => ({
      rowNumber: item.rowNumber,
      externalImportId: item.externalImportId,
      bookingId: item.id,
      bookingCode: item.bookingCode,
      status: "created",
    }));

    const syncSummary = await syncImportedBookings(
      supabase,
      user.id,
      inserted.map((item) => item.id),
      locale,
      publicOrigin,
    );

    const report = buildCommitReportFile(
      "import_commit_report.xlsx",
      validation.previewRows,
      commitRows,
    );

    return NextResponse.json({
      success: true,
      summary: {
        totalRows: validation.summary.totalRows,
        importedRows: inserted.length,
        failedRows: validation.summary.totalRows - inserted.length,
      },
      commitRows,
      syncSummary,
      report,
    });
  } catch (error) {
    if (error instanceof BookingWriteAccessDeniedError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }
    const message =
      error instanceof Error ? error.message : apiText(request, "failedCommitImport");
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
