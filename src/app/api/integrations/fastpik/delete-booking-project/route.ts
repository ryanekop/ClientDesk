import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { deleteBookingProjectFromFastpik } from "@/lib/fastpik-integration/server";

export const dynamic = "force-dynamic";

type DeleteBookingProjectPayload = {
  bookingId?: string;
  locale?: string;
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, status: "failed", error: "Tidak terautentikasi." },
        { status: 401 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as DeleteBookingProjectPayload;
    const bookingId =
      typeof body.bookingId === "string" ? body.bookingId.trim() : "";
    if (!bookingId) {
      return NextResponse.json(
        {
          success: false,
          status: "failed",
          error: "bookingId wajib diisi.",
        },
        { status: 400 },
      );
    }

    const locale = typeof body.locale === "string" ? body.locale : "id";
    const result = await deleteBookingProjectFromFastpik({
      supabase,
      userId: user.id,
      bookingId,
      locale,
    });

    return NextResponse.json({
      success: result.success,
      status: result.status,
      bookingId: result.bookingId || bookingId,
      projectId: result.projectId || null,
      action: result.action || null,
      message: result.message,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        status: "failed",
        action: null,
        message: error?.message || "Gagal menghapus project Fastpik.",
      },
      { status: 500 },
    );
  }
}
