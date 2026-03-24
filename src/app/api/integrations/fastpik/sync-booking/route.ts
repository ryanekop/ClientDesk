import { NextRequest, NextResponse } from "next/server";
import {
  assertBookingWriteAccessForUser,
  BookingWriteAccessDeniedError,
} from "@/lib/booking-write-access.server";
import { createClient } from "@/utils/supabase/server";
import { syncBookingToFastpik } from "@/lib/fastpik-integration/server";

export const dynamic = "force-dynamic";

type SyncBookingPayload = {
  bookingId?: string;
  locale?: string;
  force?: boolean;
  mode?: "manual" | "auto";
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Tidak terautentikasi." },
        { status: 401 },
      );
    }

    await assertBookingWriteAccessForUser(user.id);

    const body = (await request.json().catch(() => ({}))) as SyncBookingPayload;
    const bookingId =
      typeof body.bookingId === "string" ? body.bookingId.trim() : "";
    if (!bookingId) {
      return NextResponse.json(
        { success: false, error: "bookingId wajib diisi." },
        { status: 400 },
      );
    }

    const locale = typeof body.locale === "string" ? body.locale : "id";
    const forceManual =
      typeof body.force === "boolean"
        ? body.force
        : (body.mode || "auto") === "manual";

    const result = await syncBookingToFastpik({
      supabase,
      userId: user.id,
      bookingId,
      locale,
      force: forceManual,
    });

    return NextResponse.json({
      success: result.success,
      status: result.status,
      bookingId: result.bookingId,
      projectId: result.projectId || null,
      projectLink: result.projectLink || null,
      projectEditLink: result.projectEditLink || null,
      fastpikProjectInfo: result.fastpikProjectInfo || null,
      message: result.message,
    });
  } catch (error: any) {
    if (error instanceof BookingWriteAccessDeniedError) {
      return NextResponse.json(
        {
          success: false,
          status: "failed",
          message: error.message,
        },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        success: false,
        status: "failed",
        message: error?.message || "Gagal sinkron booking ke Fastpik.",
      },
      { status: 500 },
    );
  }
}
