import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  loadImportContext,
  validateImportWorkbook,
} from "@/lib/bookings-import/core";

export const runtime = "nodejs";

export async function POST(request: Request) {
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

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "File .xlsx wajib diupload." },
        { status: 400 },
      );
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json(
        { success: false, error: "Format file harus .xlsx." },
        { status: 400 },
      );
    }

    const { context, error } = await loadImportContext(supabase, user.id);
    if (!context || error) {
      return NextResponse.json(
        { success: false, error: error || "Gagal memuat context import." },
        { status: 500 },
      );
    }

    const buffer = await file.arrayBuffer();
    const validation = await validateImportWorkbook(
      supabase,
      user.id,
      context,
      buffer,
      { fileNamePrefix: "import_validation_report" },
    );

    return NextResponse.json({
      success: true,
      canCommit: validation.canCommit,
      summary: validation.summary,
      previewRows: validation.previewRows,
      report: validation.report,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal memvalidasi file import.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
