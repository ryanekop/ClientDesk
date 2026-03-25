import { NextRequest, NextResponse } from "next/server";
import {
  assertBookingWriteAccessForUser,
  BookingWriteAccessDeniedError,
} from "@/lib/booking-write-access.server";
import { apiText } from "@/lib/i18n/api-errors";
import { createClient } from "@/utils/supabase/server";
import {
  hydrateFastpikLiveData,
  type FastpikLiveBookingFields,
} from "@/lib/fastpik-live-sync";

export const dynamic = "force-dynamic";

type LiveBookingPayload = {
  bookingId?: string;
  locale?: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    const message = (error as { message: string }).message.trim();
    if (message) return message;
  }
  return fallback;
}

export async function POST(request: NextRequest) {
  try {
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

    const body = (await request.json().catch(() => ({}))) as LiveBookingPayload;
    const bookingId =
      typeof body.bookingId === "string" ? body.bookingId.trim() : "";
    if (!bookingId) {
      return NextResponse.json(
        { success: false, error: apiText(request, "bookingIdRequired") },
        { status: 400 },
      );
    }

    const { data: bookingRow, error: bookingError } = await supabase
      .from("bookings")
      .select(
        "id, user_id, fastpik_project_id, fastpik_project_link, fastpik_project_edit_link, fastpik_sync_status, fastpik_last_synced_at, extra_fields",
      )
      .eq("id", bookingId)
      .eq("user_id", user.id)
      .single();

    if (bookingError || !bookingRow) {
      return NextResponse.json(
        {
          success: false,
          error: bookingError?.message || apiText(request, "bookingNotFound"),
        },
        { status: 404 },
      );
    }

    const liveResult = await hydrateFastpikLiveData({
      supabase,
      booking: bookingRow as FastpikLiveBookingFields,
      locale: typeof body.locale === "string" ? body.locale : "id",
    });

    return NextResponse.json({
      success: true,
      source: liveResult.source,
      attempted: liveResult.attempted,
      throttled: liveResult.throttled,
      syncedAt: liveResult.syncedAt,
      message: liveResult.message,
      fastpikProjectInfo: liveResult.fastpikProjectInfo,
      booking: liveResult.booking,
    });
  } catch (error: unknown) {
    if (error instanceof BookingWriteAccessDeniedError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(
          error,
          apiText(request, "failedFetchFastpikBooking"),
        ),
      },
      { status: 500 },
    );
  }
}
