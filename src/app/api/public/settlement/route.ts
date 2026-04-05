import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  createPaymentSourceFromBank,
  getEnabledBankAccounts,
  normalizeBankAccounts,
  normalizePaymentMethods,
  type PaymentMethod,
  type PaymentSource,
} from "@/lib/payment-config";
import {
  getRemainingFinalPayment,
  getSettlementStatus,
} from "@/lib/final-settlement";
import { uploadPaymentProofToDrive } from "@/lib/payment-proof-drive";
import { invalidatePublicCachesForBooking } from "@/lib/public-cache-invalidation";
import { apiText } from "@/lib/i18n/api-errors";
import { securityErrorResponse } from "@/lib/security/error-response";
import { validatePublicPaymentProofFile } from "@/lib/security/public-upload";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { validateExternalHttpsUrl } from "@/lib/security/url-validation";

type VendorRecord = {
  vendor_slug: string | null;
  qris_image_url: string | null;
  qris_drive_file_id: string | null;
  form_payment_methods: PaymentMethod[] | null;
  settlement_form_payment_methods: PaymentMethod[] | null;
  form_show_proof: boolean | null;
  bank_accounts: unknown[] | null;
  google_drive_access_token: string | null;
  google_drive_refresh_token: string | null;
  drive_folder_format: string | null;
  drive_folder_format_map: Record<string, string> | null;
  drive_folder_structure_map: Record<string, string[] | string> | null;
  studio_name: string | null;
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: NextRequest) {
  const rateLimitedResponse = enforceRateLimit({
    request,
    namespace: "public-post-settlement",
    maxRequests: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimitedResponse) {
    return rateLimitedResponse;
  }

  try {
    const contentType = request.headers.get("content-type") || "";
    let trackingUuid = "";
    let paymentMethod: PaymentMethod | null = null;
    let paymentSource: PaymentSource | null = null;
    let paymentProofUrl: string | null = null;
    let paymentProofFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      trackingUuid = String(formData.get("trackingUuid") || "");
      paymentMethod = formData.get("paymentMethod")
        ? (String(formData.get("paymentMethod")) as PaymentMethod)
        : null;
      paymentSource = formData.get("paymentSource")
        ? (JSON.parse(String(formData.get("paymentSource"))) as PaymentSource)
        : null;
      paymentProofUrl = formData.get("paymentProofUrl")
        ? String(formData.get("paymentProofUrl"))
        : null;
      const nextFile = formData.get("paymentProofFile");
      paymentProofFile = nextFile instanceof File && nextFile.size > 0 ? nextFile : null;
    } else {
      const body = await request.json();
      trackingUuid = body.trackingUuid;
      paymentMethod = body.paymentMethod;
      paymentSource = body.paymentSource;
      paymentProofUrl = body.paymentProofUrl;
    }

    if (paymentProofFile) {
      const fileValidation = validatePublicPaymentProofFile(paymentProofFile, {
        fileTooLargeMessage: apiText(request, "maxFile5mb"),
      });
      if (!fileValidation.valid) {
        return securityErrorResponse({
          message: fileValidation.message,
          code: fileValidation.code,
          status: fileValidation.status,
        });
      }
    }

    const paymentProofUrlValidation = validateExternalHttpsUrl(
      typeof paymentProofUrl === "string" ? paymentProofUrl : null,
      { allowEmpty: true, maxLength: 2048 },
    );
    if (!paymentProofUrlValidation.valid) {
      return securityErrorResponse({
        message: paymentProofUrlValidation.error || "URL bukti pembayaran tidak valid.",
        code: "INVALID_URL",
        status: 400,
      });
    }
    const normalizedPaymentProofInputUrl = paymentProofUrlValidation.normalizedUrl;

    if (!trackingUuid) {
      return NextResponse.json(
        { success: false, error: "Tracking UUID wajib diisi." },
        { status: 400 },
      );
    }

    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, booking_code, client_name, event_type, session_date, user_id, total_price, dp_paid, is_fully_paid, settlement_status, final_adjustments, extra_fields",
      )
      .eq("tracking_uuid", trackingUuid)
      .single();

    if (!booking) {
      return NextResponse.json(
        { success: false, error: "Booking tidak ditemukan." },
        { status: 404 },
      );
    }

    const settlementStatus = getSettlementStatus(booking.settlement_status);
    if (booking.is_fully_paid || settlementStatus === "paid") {
      return NextResponse.json(
        { success: false, error: "Booking ini sudah lunas." },
        { status: 400 },
      );
    }

    const remaining = getRemainingFinalPayment({
      total_price: booking.total_price,
      dp_paid: booking.dp_paid,
      final_adjustments: booking.final_adjustments,
      is_fully_paid: booking.is_fully_paid,
      settlement_status: booking.settlement_status,
    });

    if (remaining <= 0) {
      return NextResponse.json(
        { success: false, error: "Tidak ada sisa pelunasan." },
        { status: 400 },
      );
    }

    const { data: vendor } = await supabaseAdmin
      .from("profiles")
      .select("vendor_slug, qris_image_url, qris_drive_file_id, form_payment_methods, settlement_form_payment_methods, form_show_proof, bank_accounts, google_drive_access_token, google_drive_refresh_token, drive_folder_format, drive_folder_format_map, drive_folder_structure_map, studio_name")
      .eq("id", booking.user_id)
      .single();

    const vendorRecord = vendor as VendorRecord | null;
    if (!vendorRecord) {
      return NextResponse.json(
        { success: false, error: "Vendor tidak ditemukan." },
        { status: 404 },
      );
    }

    const availablePaymentMethods = normalizePaymentMethods(
      vendorRecord.settlement_form_payment_methods ??
        vendorRecord.form_payment_methods,
    );
    const proofEnabled = vendorRecord.form_show_proof ?? true;
    const enabledBankAccounts = getEnabledBankAccounts(
      normalizeBankAccounts(vendorRecord.bank_accounts),
    );
    const selectedPaymentMethod = paymentMethod as PaymentMethod | null;
    let normalizedPaymentSource: PaymentSource | null = null;

    if (
      !selectedPaymentMethod ||
      !availablePaymentMethods.includes(selectedPaymentMethod)
    ) {
      return NextResponse.json(
        { success: false, error: "Metode pembayaran tidak valid." },
        { status: 400 },
      );
    }

    if (selectedPaymentMethod === "bank") {
      const requestedBankId =
        paymentSource &&
        typeof paymentSource === "object" &&
        paymentSource.type === "bank" &&
        typeof paymentSource.bank_id === "string"
          ? paymentSource.bank_id
          : "";
      const matchedBank = enabledBankAccounts.find(
        (bank) => bank.id === requestedBankId,
      );
      if (!matchedBank) {
        return NextResponse.json(
          { success: false, error: "Rekening bank tidak valid." },
          { status: 400 },
        );
      }
      normalizedPaymentSource = createPaymentSourceFromBank(matchedBank);
    } else if (selectedPaymentMethod === "qris") {
      if (!vendorRecord.qris_image_url && !vendorRecord.qris_drive_file_id) {
        return NextResponse.json(
          { success: false, error: "QRIS tidak tersedia." },
          { status: 400 },
        );
      }
      normalizedPaymentSource = { type: "qris", label: "QRIS" };
    } else {
      normalizedPaymentSource = { type: "cash", label: "Cash" };
    }

    if (
      proofEnabled &&
      selectedPaymentMethod !== "cash" &&
      !paymentProofUrl &&
      !paymentProofFile
    ) {
      return NextResponse.json(
        { success: false, error: "Bukti pembayaran wajib diupload." },
        { status: 400 },
      );
    }

    if (
      proofEnabled &&
      selectedPaymentMethod !== "cash" &&
      paymentProofFile &&
      (!vendorRecord.google_drive_access_token ||
        !vendorRecord.google_drive_refresh_token)
    ) {
      return NextResponse.json(
        { success: false, error: "Google Drive admin belum terhubung." },
        { status: 400 },
      );
    }

    let normalizedProofUrl =
      selectedPaymentMethod === "cash" || !proofEnabled
        ? null
        : normalizedPaymentProofInputUrl || null;
    let proofFileId: string | null = null;

    if (proofEnabled && selectedPaymentMethod !== "cash" && paymentProofFile) {
      if (
        !vendorRecord.google_drive_access_token ||
        !vendorRecord.google_drive_refresh_token
      ) {
        return NextResponse.json(
          { success: false, error: "Google Drive admin belum terhubung." },
          { status: 400 },
        );
      }

      const fileBuffer = Buffer.from(await paymentProofFile.arrayBuffer());
      const uploaded = await uploadPaymentProofToDrive({
        accessToken: vendorRecord.google_drive_access_token,
        refreshToken: vendorRecord.google_drive_refresh_token,
        driveFolderFormat: vendorRecord.drive_folder_format,
        driveFolderFormatMap: vendorRecord.drive_folder_format_map,
        driveFolderStructureMap: vendorRecord.drive_folder_structure_map,
        studioName: vendorRecord.studio_name,
        bookingCode: booking.booking_code,
        clientName: booking.client_name,
        eventType: booking.event_type,
        sessionDate: booking.session_date,
        extraFields: booking.extra_fields,
        fileName: paymentProofFile.name || `${booking.booking_code}_final_payment_proof`,
        mimeType: paymentProofFile.type || "application/octet-stream",
        fileBuffer,
        stage: "final",
      });
      normalizedProofUrl = uploaded.fileUrl;
      proofFileId = uploaded.fileId;
    }

    const { error } = await supabaseAdmin
      .from("bookings")
      .update({
        final_payment_proof_url:
          selectedPaymentMethod === "cash" ? null : normalizedProofUrl || null,
        final_payment_proof_drive_file_id:
          selectedPaymentMethod === "cash" ? null : proofFileId,
        final_payment_amount: remaining,
        final_payment_method: selectedPaymentMethod,
        final_payment_source: normalizedPaymentSource,
        settlement_status: "submitted",
      })
      .eq("id", booking.id);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    invalidatePublicCachesForBooking({
      bookingCode: booking.booking_code,
      trackingUuid,
      userId: booking.user_id,
      vendorSlug: vendorRecord.vendor_slug || null,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat mengirim pelunasan." },
      { status: 500 },
    );
  }
}
