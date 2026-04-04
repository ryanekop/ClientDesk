import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import SettlementClient from "./settlement-client";
import {
  normalizeBankAccounts,
  normalizePaymentMethods,
  resolveDriveImageUrl,
} from "@/lib/payment-config";
import { normalizeFinalAdjustments } from "@/lib/final-settlement";
import {
  getWhatsAppTemplateContent,
  resolveWhatsAppTemplateMode,
  type WhatsAppTemplate,
} from "@/lib/whatsapp-template";
import { resolveSpecialOfferSnapshotFromExtraFields } from "@/lib/booking-special-offer";
import { normalizeBookingServiceSelections } from "@/lib/booking-services";
import { buildSeoMetadata } from "@/lib/seo-metadata";
import { getTenantConfig } from "@/lib/tenant-config";

export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface PageProps {
  params: Promise<{ uuid: string; locale: string }>;
}

type SettlementProfileRow = {
  studio_name: string | null;
  whatsapp_number: string | null;
  avatar_url?: string | null;
  invoice_logo_url?: string | null;
  seo_meta_title?: string | null;
  seo_meta_description?: string | null;
  seo_meta_keywords?: string | null;
  seo_settlement_meta_title?: string | null;
  seo_settlement_meta_description?: string | null;
  seo_settlement_meta_keywords?: string | null;
  form_payment_methods?: string[] | null;
  form_show_proof?: boolean | null;
  settlement_form_brand_color?: string | null;
  settlement_form_greeting?: string | null;
  settlement_form_payment_methods?: string[] | null;
  settlement_form_lang?: string | null;
  qris_image_url?: string | null;
  qris_drive_file_id?: string | null;
  bank_accounts?: unknown[] | null;
};

function isMissingColumnError(message: string | null | undefined) {
  const text = (message || "").toLowerCase();
  return text.includes("could not find") || text.includes("does not exist");
}

async function getSettlementData(uuid: string) {
  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, booking_code, tracking_uuid, client_name, client_whatsapp, instagram, session_date, event_type, total_price, dp_paid, is_fully_paid, status, settlement_status, final_adjustments, final_payment_amount, final_payment_method, final_payment_source, final_payment_proof_url, final_paid_at, final_invoice_sent_at, extra_fields, user_id, services(id, name, duration_minutes, is_addon, affects_schedule), booking_services(id, kind, sort_order, service:services(id, name, duration_minutes, is_addon, affects_schedule))",
    )
    .eq("tracking_uuid", uuid)
    .single();

  if (!booking) return null;

  const [{ profile }, { data: templates }] = await Promise.all([
    (async () => {
      const profileSelectWithSeo =
        "studio_name, whatsapp_number, avatar_url, invoice_logo_url, " +
        "seo_meta_title, seo_meta_description, seo_meta_keywords, " +
        "seo_settlement_meta_title, seo_settlement_meta_description, seo_settlement_meta_keywords, " +
        "form_payment_methods, form_show_proof, settlement_form_brand_color, settlement_form_greeting, settlement_form_payment_methods, settlement_form_lang, qris_image_url, qris_drive_file_id, bank_accounts";

      const { data: profileWithSeo, error: profileWithSeoError } =
        await supabaseAdmin
          .from("profiles")
          .select(profileSelectWithSeo)
          .eq("id", booking.user_id)
          .single<SettlementProfileRow>();

      if (profileWithSeo || !isMissingColumnError(profileWithSeoError?.message)) {
        return { profile: profileWithSeo };
      }

      const profileSelectLegacy =
        "studio_name, whatsapp_number, avatar_url, invoice_logo_url, " +
        "form_payment_methods, form_show_proof, settlement_form_brand_color, settlement_form_greeting, settlement_form_payment_methods, settlement_form_lang, qris_image_url, qris_drive_file_id, bank_accounts";
      const { data: profileLegacy } = await supabaseAdmin
        .from("profiles")
        .select(profileSelectLegacy)
        .eq("id", booking.user_id)
        .single<SettlementProfileRow>();

      return { profile: profileLegacy };
    })(),
    supabaseAdmin
      .from("templates")
      .select("type, name, content, content_en, event_type")
      .eq("user_id", booking.user_id),
  ]);

  const normalizedTemplates: WhatsAppTemplate[] = Array.isArray(templates)
    ? templates.map((template) => ({
        type: typeof template.type === "string" ? template.type : "",
        name: typeof template.name === "string" ? template.name : null,
        content: typeof template.content === "string" ? template.content : "",
        content_en:
          typeof template.content_en === "string" ? template.content_en : "",
        event_type:
          typeof template.event_type === "string" ? template.event_type : null,
      }))
    : [];
  const templateMode = resolveWhatsAppTemplateMode({
    eventType: booking.event_type,
    extraFields: booking.extra_fields,
  });
  const settlementConfirmTemplate = getWhatsAppTemplateContent(
    normalizedTemplates,
    "whatsapp_settlement_confirm",
    "id",
    booking.event_type,
    templateMode,
  );
  const settlementConfirmTemplateEn = getWhatsAppTemplateContent(
    normalizedTemplates,
    "whatsapp_settlement_confirm",
    "en",
    booking.event_type,
    templateMode,
  );
  const specialOffer = resolveSpecialOfferSnapshotFromExtraFields(booking.extra_fields);
  const serviceSelections = normalizeBookingServiceSelections(
    (booking as { booking_services?: unknown[] }).booking_services,
    booking.services,
  );

  return {
    booking: {
      bookingCode: booking.booking_code,
      trackingUuid: booking.tracking_uuid,
      clientName: booking.client_name,
      clientWhatsapp: booking.client_whatsapp || null,
      instagram: booking.instagram || null,
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
      serviceSelections,
      extraFields: (booking.extra_fields as Record<string, unknown> | null) || null,
      initialBreakdown: specialOffer
        ? {
            packageTotal: specialOffer.package_total,
            addonTotal: specialOffer.addon_total,
            accommodationFee: specialOffer.accommodation_fee,
            discountAmount: specialOffer.discount_amount,
          }
        : null,
    },
    vendor: {
      studioName: profile?.studio_name || "Studio",
      whatsappNumber: profile?.whatsapp_number || null,
      avatarUrl: profile?.avatar_url || null,
      invoiceLogoUrl: profile?.invoice_logo_url || null,
      seoMetaTitle: profile?.seo_meta_title || null,
      seoMetaDescription: profile?.seo_meta_description || null,
      seoMetaKeywords: profile?.seo_meta_keywords || null,
      seoSettlementMetaTitle: profile?.seo_settlement_meta_title || null,
      seoSettlementMetaDescription: profile?.seo_settlement_meta_description || null,
      seoSettlementMetaKeywords: profile?.seo_settlement_meta_keywords || null,
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
        { trackingUuid: booking.tracking_uuid },
      ),
      bankAccounts: normalizeBankAccounts(profile?.bank_accounts),
      settlementConfirmTemplate,
      settlementConfirmTemplateEn,
    },
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { uuid } = await params;
  const result = await getSettlementData(uuid);
  const tenant = await getTenantConfig();

  if (!result) {
    return { title: "Settlement Not Found" };
  }

  const studioName = result.vendor.studioName || "Studio";
  const fallbackTitle = `Pelunasan - ${result.booking.bookingCode}`;
  const fallbackDescription = `Form pelunasan untuk booking ${result.booking.bookingCode}`;

  return buildSeoMetadata({
    page: "settlement",
    profileSeo: {
      seo_meta_title: result.vendor.seoMetaTitle,
      seo_meta_description: result.vendor.seoMetaDescription,
      seo_meta_keywords: result.vendor.seoMetaKeywords,
      seo_settlement_meta_title: result.vendor.seoSettlementMetaTitle,
      seo_settlement_meta_description: result.vendor.seoSettlementMetaDescription,
      seo_settlement_meta_keywords: result.vendor.seoSettlementMetaKeywords,
    },
    variables: {
      studio_name: studioName,
      client_name: result.booking.clientName || "",
      booking_code: result.booking.bookingCode || "",
      status: result.booking.status || "",
      event_type: result.booking.eventType || "",
      session_date: result.booking.sessionDate || "",
      tracking_uuid: result.booking.trackingUuid || uuid,
      settlement_uuid: result.booking.trackingUuid || uuid,
    },
    fallbackTitle,
    fallbackDescription,
    fallbackImageUrl:
      result.vendor.invoiceLogoUrl ||
      result.vendor.avatarUrl ||
      tenant.logoUrl ||
      null,
  });
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
