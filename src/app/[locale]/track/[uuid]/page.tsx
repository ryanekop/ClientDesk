import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import TrackingClient from "./track-client";
import {
    getFinalAdjustmentsTotal,
    getFinalInvoiceTotal,
    getRemainingFinalPayment,
    normalizeFinalAdjustments,
} from "@/lib/final-settlement";
import {
    resolveUnifiedBookingStatus,
    shouldShowTrackingFileLinksForClientStatus,
    shouldShowFinalInvoiceForClientStatus,
} from "@/lib/client-status";
import {
    type FastpikLinkDisplayMode,
} from "@/lib/fastpik-link-display";
import { resolveSpecialOfferSnapshotFromExtraFields } from "@/lib/booking-special-offer";
import {
    getBookingServiceLabel,
    normalizeBookingServiceSelections,
    type BookingServiceSelection,
} from "@/lib/booking-services";
import { resolveFastpikProjectInfoFromExtraFields } from "@/lib/fastpik-project-info";
import {
    hydrateFastpikLiveData,
    type FastpikLiveBookingFields,
} from "@/lib/fastpik-live-sync";
import { resolveBookingCalendarSessions } from "@/lib/booking-calendar-sessions";
import { getTrackBasePayloadCached } from "@/lib/public-track-data";
import { buildSeoMetadata } from "@/lib/seo-metadata";
import { getTenantConfig } from "@/lib/tenant-config";
import { buildSignedInvoicePath } from "@/lib/security/invoice-access";

// Admin client — runs server-side only, never exposed to browser
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface PageProps {
    params: Promise<{ uuid: string; locale: string }>;
}

type BookingRow = {
    id: string;
    booking_code: string;
    tracking_uuid: string | null;
    client_name: string;
    session_date: string | null;
    event_type: string | null;
    client_status: string | null;
    queue_position: number | null;
    status: string;
    drive_folder_url: string | null;
    fastpik_project_link: string | null;
    fastpik_project_id: string | null;
    fastpik_project_edit_link: string | null;
    fastpik_sync_status: string | null;
    fastpik_last_synced_at: string | null;
    total_price: number;
    dp_paid: number;
    is_fully_paid: boolean;
    settlement_status: string | null;
    final_adjustments: unknown;
    final_payment_amount: number | null;
    final_paid_at: string | null;
    final_invoice_sent_at: string | null;
    location: string | null;
    extra_fields: Record<string, unknown> | null;
    created_at: string;
    user_id: string;
    services: { name?: string } | null;
    booking_services?: BookingServiceSelection[] | unknown[] | null;
};

async function getBookingData(
    uuid: string,
    locale: string,
    options: { skipLiveFastpik?: boolean } = {},
) {
    const basePayload = await getTrackBasePayloadCached(uuid, locale);
    if (!basePayload) return null;

    let fastpikDataSource: "live" | "fallback" = "fallback";
    let fastpikDataSyncedAt: string | null =
        basePayload.booking.fastpik_last_synced_at || null;
    let fastpikDataMessage: string | null = null;
    let effectiveBooking = basePayload.booking as BookingRow;
    if (!options.skipLiveFastpik) {
        const liveFastpikResult = await hydrateFastpikLiveData({
            supabase: supabaseAdmin,
            booking: basePayload.booking as FastpikLiveBookingFields,
            locale,
        });
        effectiveBooking = {
            ...basePayload.booking,
            ...liveFastpikResult.booking,
        };
        fastpikDataSource = liveFastpikResult.source;
        fastpikDataSyncedAt = liveFastpikResult.syncedAt;
        fastpikDataMessage = liveFastpikResult.message;
    }

    return {
        booking: effectiveBooking,
        vendorName: basePayload.vendorName,
        vendorLogoUrl: basePayload.vendorLogoUrl,
        vendorAvatarUrl: basePayload.vendorAvatarUrl,
        seoMetaTitle: basePayload.seoMetaTitle,
        seoMetaDescription: basePayload.seoMetaDescription,
        seoMetaKeywords: basePayload.seoMetaKeywords,
        seoTrackMetaTitle: basePayload.seoTrackMetaTitle,
        seoTrackMetaDescription: basePayload.seoTrackMetaDescription,
        seoTrackMetaKeywords: basePayload.seoTrackMetaKeywords,
        customClientStatuses: basePayload.customClientStatuses,
        queueTriggerStatus: basePayload.queueTriggerStatus,
        finalInvoiceVisibleFromStatus: basePayload.finalInvoiceVisibleFromStatus,
        trackingFileLinksVisibleFromStatus: basePayload.trackingFileLinksVisibleFromStatus,
        trackingHideQueueNumber: basePayload.trackingHideQueueNumber,
        fastpikLinkDisplayMode: basePayload.fastpikLinkDisplayMode as FastpikLinkDisplayMode,
        fastpikDataSource,
        fastpikDataSyncedAt,
        fastpikDataMessage,
    };
}

// ── Dynamic metadata for SEO & WhatsApp link previews ──────────────────────
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { uuid, locale } = await params;
    const result = await getBookingData(uuid, locale, {
        skipLiveFastpik: true,
    });
    const tenant = await getTenantConfig();

    if (!result) {
        return { title: "Booking Not Found" };
    }

    const { booking, vendorName } = result;
    const status = resolveUnifiedBookingStatus({
        status: booking.status,
        clientStatus: booking.client_status,
        statuses: result.customClientStatuses,
    });
    const studioName = vendorName || "Studio";
    const fallbackTitle = `${status} — ${booking.client_name} — ${booking.booking_code}`;
    const fallbackDescription = `Tracking booking ${booking.booking_code} untuk ${booking.client_name}${vendorName ? ` di ${vendorName}` : ""}`;

    return buildSeoMetadata({
        page: "track",
        profileSeo: {
            seo_meta_title: result.seoMetaTitle,
            seo_meta_description: result.seoMetaDescription,
            seo_meta_keywords: result.seoMetaKeywords,
            seo_track_meta_title: result.seoTrackMetaTitle,
            seo_track_meta_description: result.seoTrackMetaDescription,
            seo_track_meta_keywords: result.seoTrackMetaKeywords,
        },
        variables: {
            studio_name: studioName,
            client_name: booking.client_name || "",
            booking_code: booking.booking_code || "",
            status: status || "",
            event_type: booking.event_type || "",
            session_date: booking.session_date || "",
            tracking_uuid: booking.tracking_uuid || uuid,
            settlement_uuid: booking.tracking_uuid || uuid,
        },
        fallbackTitle,
        fallbackDescription,
        fallbackImageUrl:
            result.vendorLogoUrl || result.vendorAvatarUrl || tenant.logoUrl || null,
    });
}

// ── Page — Server Component ───────────────────────────────────────────────────
export default async function TrackingPage({ params }: PageProps) {
    const { uuid, locale } = await params;
    const result = await getBookingData(uuid, locale, {
        skipLiveFastpik: true,
    });

    if (!result) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 px-4">
                <div className="text-center space-y-4 max-w-md mx-auto">
                    <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto text-4xl">🔍</div>
                    <h2 className="text-2xl font-bold">Booking Tidak Ditemukan</h2>
                    <p className="text-muted-foreground">Link tracking tidak valid atau booking sudah dihapus.</p>
                </div>
            </div>
        );
    }

    const {
        booking,
        vendorName,
        customClientStatuses,
        finalInvoiceVisibleFromStatus,
        trackingFileLinksVisibleFromStatus,
        fastpikDataSource,
        fastpikDataSyncedAt,
        fastpikDataMessage,
    } = result;
    const finalAdjustments = normalizeFinalAdjustments(booking.final_adjustments);
    const specialOffer = resolveSpecialOfferSnapshotFromExtraFields(booking.extra_fields);
    const fastpikProjectInfo = resolveFastpikProjectInfoFromExtraFields(booking.extra_fields);
    const finalAdjustmentsTotal = getFinalAdjustmentsTotal(finalAdjustments);
    const finalInvoiceTotal = getFinalInvoiceTotal(booking.total_price || 0, finalAdjustments);
    const remainingFinalPayment = getRemainingFinalPayment({
        total_price: booking.total_price || 0,
        dp_paid: booking.dp_paid || 0,
        final_adjustments: finalAdjustments,
        final_payment_amount: booking.final_payment_amount || 0,
        final_paid_at: booking.final_paid_at,
        settlement_status: booking.settlement_status,
        is_fully_paid: booking.is_fully_paid || false,
    });

    const effectiveClientStatus = resolveUnifiedBookingStatus({
        status: booking.status,
        clientStatus: booking.client_status,
        statuses: customClientStatuses,
    });
    const sessionRows = resolveBookingCalendarSessions({
        eventType: booking.event_type,
        sessionDate: booking.session_date,
        extraFields: booking.extra_fields,
        defaultLocation: booking.location,
    });
    const serviceSelections = normalizeBookingServiceSelections(
        booking.booking_services,
        booking.services,
    );
    const serviceName = getBookingServiceLabel(serviceSelections, {
        fallback: booking.event_type || "Booking",
    });

    const bookingData = {
        bookingCode: booking.booking_code,
        trackingUuid: booking.tracking_uuid,
        clientName: booking.client_name,
        sessionDate: booking.session_date,
        sessionRows,
        eventType: booking.event_type,
        clientStatus: effectiveClientStatus,
        queueTriggerStatus: result.queueTriggerStatus || "Antrian Edit",
        trackingHideQueueNumber: Boolean(result.trackingHideQueueNumber),
        queuePosition: booking.queue_position,
        status: booking.status,
        serviceName,
        invoiceUrlInitial: buildSignedInvoicePath({
            bookingCode: booking.booking_code,
            stage: "initial",
            lang: locale,
        }),
        invoiceUrlFinal: buildSignedInvoicePath({
            bookingCode: booking.booking_code,
            stage: "final",
            lang: locale,
        }),
        fastpikUrl: booking.fastpik_project_link,
        driveUrl: booking.drive_folder_url,
        fastpikLinkDisplayMode: result.fastpikLinkDisplayMode,
        createdAt: booking.created_at,
        totalPrice: booking.total_price || 0,
        dpPaid: booking.dp_paid || 0,
        isFullyPaid: booking.is_fully_paid || false,
        settlementStatus: booking.settlement_status || "draft",
        finalAdjustmentsTotal,
        finalInvoiceTotal,
        remainingFinalPayment,
        finalInvoiceSentAt: booking.final_invoice_sent_at,
        location: booking.location || null,
        initialBreakdown: specialOffer
            ? {
                packageTotal: specialOffer.package_total,
                addonTotal: specialOffer.addon_total,
                accommodationFee: specialOffer.accommodation_fee,
                discountAmount: specialOffer.discount_amount,
            }
            : null,
        fastpikProjectInfo,
        fastpikDataSource,
        fastpikDataSyncedAt,
        fastpikDataMessage,
        showFinalInvoice: shouldShowFinalInvoiceForClientStatus({
            statuses: customClientStatuses,
            currentStatus: effectiveClientStatus,
            visibleFromStatus: finalInvoiceVisibleFromStatus,
        }),
        showFileResults: shouldShowTrackingFileLinksForClientStatus({
            statuses: customClientStatuses,
            currentStatus: effectiveClientStatus,
            visibleFromStatus: trackingFileLinksVisibleFromStatus,
        }),
    };

    return <TrackingClient booking={bookingData} vendorName={vendorName} customStatuses={customClientStatuses} />;
}
