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

type VendorRecord = {
  qris_image_url: string | null;
  form_payment_methods: PaymentMethod[] | null;
  bank_accounts: unknown[] | null;
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trackingUuid, paymentMethod, paymentSource, paymentProofUrl } = body;

    if (!trackingUuid) {
      return NextResponse.json(
        { success: false, error: "Tracking UUID wajib diisi." },
        { status: 400 },
      );
    }

    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, user_id, total_price, dp_paid, is_fully_paid, settlement_status, final_adjustments",
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
    if (settlementStatus === "draft") {
      return NextResponse.json(
        { success: false, error: "Invoice final belum dibuka oleh admin." },
        { status: 400 },
      );
    }

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
      .select("qris_image_url, form_payment_methods, bank_accounts")
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
      vendorRecord.form_payment_methods,
    );
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
      if (!vendorRecord.qris_image_url) {
        return NextResponse.json(
          { success: false, error: "QRIS tidak tersedia." },
          { status: 400 },
        );
      }
      normalizedPaymentSource = { type: "qris", label: "QRIS" };
    } else {
      normalizedPaymentSource = { type: "cash", label: "Cash" };
    }

    if (selectedPaymentMethod !== "cash" && !paymentProofUrl) {
      return NextResponse.json(
        { success: false, error: "Bukti pembayaran wajib diupload." },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin
      .from("bookings")
      .update({
        final_payment_proof_url:
          selectedPaymentMethod === "cash" ? null : paymentProofUrl || null,
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

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat mengirim pelunasan." },
      { status: 500 },
    );
  }
}
