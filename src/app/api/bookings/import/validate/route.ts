import { NextRequest, NextResponse } from "next/server";
import { apiText } from "@/lib/i18n/api-errors";
import { createClient } from "@/utils/supabase/server";
import {
  buildWorkbookBufferFromPasteRows,
  loadImportContext,
  validateImportWorkbook,
} from "@/lib/bookings-import/core";

export const runtime = "nodejs";

function nodeBufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return Uint8Array.from(buffer).buffer;
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

    const { context, error } = await loadImportContext(supabase, user.id);
    if (!context || error) {
      return NextResponse.json(
        { success: false, error: error || apiText(request, "failedLoadImportContext") },
        { status: 500 },
      );
    }

    const contentType = request.headers.get("content-type") || "";
    let buffer: ArrayBuffer | null = null;

    if (contentType.includes("application/json")) {
      const payload = (await request.json().catch(() => null)) as
        | {
            mode?: string;
            rows?: unknown;
            hasHeader?: boolean | null;
          }
        | null;

      if (payload?.mode !== "paste" || !Array.isArray(payload.rows)) {
        return NextResponse.json(
          { success: false, error: apiText(request, "xlsxRequired") },
          { status: 400 },
        );
      }

      const workbook = buildWorkbookBufferFromPasteRows({
        context,
        rows: payload.rows,
        hasHeader:
          typeof payload.hasHeader === "boolean" ? payload.hasHeader : null,
      });
      buffer = nodeBufferToArrayBuffer(workbook);
    } else {
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

      buffer = await file.arrayBuffer();
    }

    if (!buffer) {
      return NextResponse.json(
        { success: false, error: apiText(request, "xlsxRequired") },
        { status: 400 },
      );
    }

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
      error instanceof Error ? error.message : apiText(request, "failedValidateImport");
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
