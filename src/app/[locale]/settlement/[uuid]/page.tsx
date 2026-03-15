import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import SettlementClient from "./settlement-client";
import {
  normalizeBankAccounts,
  normalizePaymentMethods,
  resolveDriveImageUrl,
} from "@/lib/payment-config";
import { normalizeFinalAdjustments } from "@/lib/final-settlement";
import { resolveTemplateType } from "@/lib/whatsapp-template";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface PageProps {
  params: Promise<{ uuid: string; locale: string }>;
}

async function getSettlementData(uuid: string) {
  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, booking_code, tracking_uuid, client_name, session_date, event_type, total_price, dp_paid, is_fully_paid, status, settlement_status, final_adjustments, final_payment_amount, final_payment_method, final_payment_source, final_payment_proof_url, final_paid_at, final_invoice_sent_at, user_id, services(name)",
    )
    .eq("tracking_uuid", uuid)
    .single();

  if (!booking) return null;

  const [{ data: profile }, { data: templates }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select(
        "studio_name, whatsapp_number, form_payment_methods, form_show_proof, settlement_form_brand_color, settlement_form_greeting, settlement_form_payment_methods, settlement_form_lang, qris_image_url, qris_drive_file_id, bank_accounts",
      )
      .eq("id", booking.user_id)
      .single(),
    supabaseAdmin
      .from("templates")
      .select("type, name, content, content_en")
      .eq("user_id", booking.user_id),
  ]);

  const settlementConfirmTemplate = Array.isArray(templates)
    ? templates.find((template) => resolveTemplateType(template) === "whatsapp_settlement_confirm")
    : null;

  return {
    booking: {
      bookingCode: booking.booking_code,
      trackingUuid: booking.tracking_uuid,
      clientName: booking.client_name,
      sessionDate: booking.session_date,
      eventType: booking.event_type,
      totalPrice: booking.total_price || 0,
      dpPaid: booking.dp_paid || 0,
      isFullyPaid: booking.is_fully_paid || false,
      status: booking.status,
      settlementStatus: booking.settlement_status || "draft",
      finalAdjustments: normalizeFinalAdjustments(booking.final_adjustments),
      finalPaymentAmount: booking.final_payment_amount || 0,
      finalPaymentMethod: booking.final_payment_method || null,
      finalPaymentSource: booking.final_payment_source || null,
      finalPaymentProofUrl: booking.final_payment_proof_url || null,
      finalPaidAt: booking.final_paid_at || null,
      finalInvoiceSentAt: booking.final_invoice_sent_at || null,
      serviceName: (booking.services as { name?: string } | null)?.name || null,
    },
    vendor: {
      studioName: profile?.studio_name || "Studio",
      whatsappNumber: profile?.whatsapp_number || null,
      brandColor: profile?.settlement_form_brand_color || "#10b981",
      greeting: profile?.settlement_form_greeting || null,
      formLang: profile?.settlement_form_lang || "id",
      formShowProof: profile?.form_show_proof ?? true,
      formPaymentMethods: normalizePaymentMethods(
        profile?.settlement_form_payment_methods ?? profile?.form_payment_methods,
      ),
      qrisImageUrl: resolveDriveImageUrl(
        profile?.qris_image_url || null,
        profile?.qris_drive_file_id || null,
      ),
      bankAccounts: normalizeBankAccounts(profile?.bank_accounts),
      settlementConfirmTemplate: settlementConfirmTemplate?.content || "",
      settlementConfirmTemplateEn: settlementConfirmTemplate?.content_en || "",
    },
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { uuid } = await params;
  const result = await getSettlementData(uuid);

  if (!result) {
    return { title: "Settlement Not Found" };
  }

  return {
    title: `Pelunasan - ${result.booking.bookingCode}`,
    description: `Form pelunasan untuk booking ${result.booking.bookingCode}`,
  };
}

export default async function SettlementPage({ params }: PageProps) {
  const { uuid } = await params;
  const result = await getSettlementData(uuid);

  if (!result) {
    return (
      <div className="public-light-theme min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
        <div className="text-center space-y-4 max-w-md mx-auto">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto text-4xl">
            $
          </div>
          <h2 className="text-2xl font-bold">Pelunasan Tidak Ditemukan</h2>
          <p className="text-muted-foreground">
            Link pelunasan tidak valid atau booking sudah dihapus.
          </p>
        </div>
      </div>
    );
  }

  return <SettlementClient booking={result.booking} vendor={result.vendor} />;
}
