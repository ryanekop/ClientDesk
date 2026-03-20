import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  buildTemplateWorkbookBuffer,
  loadImportContext,
} from "@/lib/bookings-import/core";

export const runtime = "nodejs";

export async function GET() {
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

    const { context, error } = await loadImportContext(supabase, user.id);
    if (!context || error) {
      return NextResponse.json(
        { success: false, error: error || "Gagal memuat context import." },
        { status: 500 },
      );
    }

    const buffer = buildTemplateWorkbookBuffer(context);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="template_batch_booking_v2.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal membuat template import.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
