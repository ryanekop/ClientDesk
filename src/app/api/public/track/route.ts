import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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
    shouldShowTrackingVideoLinksForClientStatus,
} from "@/lib/client-status";
import { resolveSpecialOfferSnapshotFromExtraFields } from "@/lib/booking-special-offer";
import {
    getBookingServiceLabel,
    normalizeBookingServiceSelections,
} from "@/lib/booking-services";
import {
    formatProjectDeadlineDate,
    getProjectDeadlineCountdownLabel,
} from "@/lib/booking-deadline";
import { resolveFastpikProjectInfoFromExtraFields } from "@/lib/fastpik-project-info";
import {
    hydrateFastpikLiveData,
    type FastpikLiveBookingFields,
} from "@/lib/fastpik-live-sync";
import { resolveBookingCalendarSessions } from "@/lib/booking-calendar-sessions";
import { getTrackBasePayloadCached } from "@/lib/public-track-data";
import { buildSignedInvoicePath } from "@/lib/security/invoice-access";
import { enforceRateLimit, withNoStoreHeaders } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
    "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
} as const;

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
    const rateLimitedResponse = enforceRateLimit({
        request,
        namespace: "public-get-track",
        maxRequests: 60,
        windowMs: 60 * 1000,
    });
    if (rateLimitedResponse) {
        return withNoStoreHeaders(rateLimitedResponse);
    }

    const uuid = request.nextUrl.searchParams.get("uuid");
    if (!uuid) {
        return NextResponse.json(
            { success: false, error: "uuid required" },
            { status: 400, headers: NO_STORE_HEADERS },
        );
    }

    const locale = request.nextUrl.searchParams.get("locale") || "id";
    const basePayload = await getTrackBasePayloadCached(uuid, locale);
    if (!basePayload) {
        return NextResponse.json(
            { success: false, error: "Booking not found" },
            { status: 404, headers: NO_STORE_HEADERS },
        );
    }

    const {
        booking: cachedBooking,
        vendorName,
        customClientStatuses,
        queueTriggerStatus,
        finalInvoiceVisibleFromStatus,
        trackingProjectDeadlineVisible,
        trackingFileLinksVisibleFromStatus,
        trackingVideoLinksVisibleFromStatus,
        trackingHideQueueNumber,
        fastpikLinkDisplayMode: profileLinkMode,
    } = basePayload;

    const liveFastpikResult = await hydrateFastpikLiveData({
        supabase: supabaseAdmin,
        booking: cachedBooking as FastpikLiveBookingFields,
        locale,
    });
    const effectiveBooking = {
        ...cachedBooking,
        ...liveFastpikResult.booking,
    };

    const finalAdjustments = normalizeFinalAdjustments(effectiveBooking.final_adjustments);
    const specialOffer = resolveSpecialOfferSnapshotFromExtraFields(effectiveBooking.extra_fields);
    const fastpikProjectInfo =
        liveFastpikResult.fastpikProjectInfo ||
        resolveFastpikProjectInfoFromExtraFields(effectiveBooking.extra_fields);
    const effectiveClientStatus = resolveUnifiedBookingStatus({
        status: effectiveBooking.status,
        clientStatus: effectiveBooking.client_status,
        statuses: customClientStatuses,
    });
    const sessionRows = resolveBookingCalendarSessions({
        eventType: effectiveBooking.event_type,
        sessionDate: effectiveBooking.session_date,
        extraFields: effectiveBooking.extra_fields,
        defaultLocation: effectiveBooking.location,
    });
    const serviceSelections = normalizeBookingServiceSelections(
        effectiveBooking.booking_services,
        effectiveBooking.services,
    );
    const serviceName = getBookingServiceLabel(serviceSelections, {
        fallback: effectiveBooking.event_type || "Booking",
    });
    const deadlineLocale = locale === "en" ? "en" : "id";
    const projectDeadlineDate =
        trackingProjectDeadlineVisible && effectiveBooking.project_deadline_date
            ? effectiveBooking.project_deadline_date
            : null;
    const projectDeadlineLabel = projectDeadlineDate
        ? formatProjectDeadlineDate(projectDeadlineDate, deadlineLocale)
        : null;
    const projectDeadlineCountdown = projectDeadlineDate
        ? getProjectDeadlineCountdownLabel(projectDeadlineDate, deadlineLocale)
        : null;

    return NextResponse.json(
        {
            success: true,
            booking: {
                bookingCode: effectiveBooking.booking_code,
                trackingUuid: effectiveBooking.tracking_uuid,
                clientName: effectiveBooking.client_name,
                sessionDate: effectiveBooking.session_date,
                sessionRows,
                eventType: effectiveBooking.event_type,
                clientStatus: effectiveClientStatus,
                projectDeadlineDate,
                projectDeadlineLabel,
                projectDeadlineCountdown,
                showProjectDeadline: Boolean(projectDeadlineDate),
                queueTriggerStatus: queueTriggerStatus || "Antrian Edit",
                trackingHideQueueNumber: Boolean(trackingHideQueueNumber),
                queuePosition: effectiveBooking.queue_position,
                status: effectiveBooking.status,
                serviceName,
                invoiceUrlInitial: buildSignedInvoicePath({
                    bookingCode: effectiveBooking.booking_code,
                    stage: "initial",
                    lang: locale,
                }),
                invoiceUrlFinal: buildSignedInvoicePath({
                    bookingCode: effectiveBooking.booking_code,
                    stage: "final",
                    lang: locale,
                }),
                fastpikUrl: effectiveBooking.fastpik_project_link,
                driveUrl: effectiveBooking.drive_folder_url,
                videoUrl:
                    effectiveBooking.video_drive_folder_url &&
                    effectiveBooking.tracking_uuid
                        ? `/${locale}/track/${effectiveBooking.tracking_uuid}/video`
                        : null,
                fastpikLinkDisplayMode: profileLinkMode,
                createdAt: effectiveBooking.created_at,
                totalPrice: effectiveBooking.total_price || 0,
                dpPaid: effectiveBooking.dp_paid || 0,
                isFullyPaid: effectiveBooking.is_fully_paid || false,
                settlementStatus: effectiveBooking.settlement_status || "draft",
                finalAdjustmentsTotal: getFinalAdjustmentsTotal(finalAdjustments),
                finalInvoiceTotal: getFinalInvoiceTotal(effectiveBooking.total_price || 0, finalAdjustments),
                remainingFinalPayment: getRemainingFinalPayment({
                    total_price: effectiveBooking.total_price || 0,
                    dp_paid: effectiveBooking.dp_paid || 0,
                    final_adjustments: finalAdjustments,
                    final_payment_amount: effectiveBooking.final_payment_amount || 0,
                    final_paid_at: effectiveBooking.final_paid_at,
                    settlement_status: effectiveBooking.settlement_status,
                    is_fully_paid: effectiveBooking.is_fully_paid || false,
                }),
                finalInvoiceSentAt: effectiveBooking.final_invoice_sent_at || null,
                location: effectiveBooking.location || null,
                initialBreakdown: specialOffer
                    ? {
                        packageTotal: specialOffer.package_total,
                        addonTotal: specialOffer.addon_total,
                        accommodationFee: specialOffer.accommodation_fee,
                        discountAmount: specialOffer.discount_amount,
                    }
                    : null,
                fastpikProjectInfo,
                fastpikDataSource: liveFastpikResult.source,
                fastpikDataSyncedAt: liveFastpikResult.syncedAt,
                fastpikDataMessage: liveFastpikResult.message,
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
                showVideoResults:
                    Boolean(effectiveBooking.video_drive_folder_url) &&
                    shouldShowTrackingVideoLinksForClientStatus({
                        statuses: customClientStatuses,
                        currentStatus: effectiveClientStatus,
                        visibleFromStatus: trackingVideoLinksVisibleFromStatus,
                    }),
            },
            vendorName,
        },
        { headers: NO_STORE_HEADERS },
    );
}
