import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { hasOAuthTokenPair } from "@/utils/google/connection";
import { fetchGoogleCalendarProfileSchemaSafe } from "@/app/api/google/_lib/calendar-profile";
import { normalizeGoogleCalendarEventIds } from "@/lib/booking-calendar-sessions";
import { deleteCalendarEvent } from "@/utils/google/calendar";

type DeleteBookingCalendarRequest = {
  bookingId?: string;
};

function isNotFoundCalendarError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return (
    message.includes("Not Found") ||
    message.includes("404") ||
    message.toLowerCase().includes("not found")
  );
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as DeleteBookingCalendarRequest;
    const bookingId = typeof payload.bookingId === "string" ? payload.bookingId : "";

    if (!bookingId) {
      return NextResponse.json(
        { success: false, error: "Missing bookingId" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Tidak terautentikasi" },
        { status: 401 },
      );
    }

    const { data: booking } = await supabase
      .from("bookings")
      .select("id, booking_code, google_calendar_event_id, google_calendar_event_ids")
      .eq("id", bookingId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!booking) {
      return NextResponse.json(
        { success: false, error: "Booking tidak ditemukan." },
        { status: 404 },
      );
    }

    const eventIdMap = normalizeGoogleCalendarEventIds(
      (booking as any).google_calendar_event_ids,
      (booking as any).google_calendar_event_id,
    );
    const eventIds = Array.from(
      new Set(
        Object.values(eventIdMap)
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    );

    if (eventIds.length === 0) {
      return NextResponse.json({
        success: true,
        deletedCount: 0,
        failedCount: 0,
      });
    }

    const profileResult = await fetchGoogleCalendarProfileSchemaSafe(
      supabase,
      user.id,
    );
    if (profileResult.error) {
      console.error("Google Calendar profile query failed:", profileResult.error);
      return NextResponse.json(
        {
          success: false,
          error: "Gagal memuat profil Google Calendar. Silakan coba lagi.",
        },
        { status: 500 },
      );
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
      return NextResponse.json(
        {
          success: false,
          error:
            "Koneksi Google Calendar belum lengkap. Silakan hubungkan ulang di Pengaturan.",
        },
        { status: 400 },
      );
    }

    let deletedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const eventId of eventIds) {
      try {
        await deleteCalendarEvent(accessToken, refreshToken, eventId);
        deletedCount++;
      } catch (error) {
        if (isNotFoundCalendarError(error)) {
          deletedCount++;
          continue;
        }

        failedCount++;
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Unknown error";
        errors.push(`${eventId}: ${message}`);
      }
    }

    return NextResponse.json({
      success: failedCount === 0,
      deletedCount,
      failedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
