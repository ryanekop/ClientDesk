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
} from "@/lib/client-status";
import { normalizeFastpikLinkDisplayMode } from "@/lib/fastpik-link-display";
import { resolveSpecialOfferSnapshotFromExtraFields } from "@/lib/booking-special-offer";
import { resolveFastpikProjectInfoFromExtraFields } from "@/lib/fastpik-project-info";
import {
    hydrateFastpikLiveData,
    type FastpikLiveBookingFields,
} from "@/lib/fastpik-live-sync";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ProfileTrackDisplayRow = {
    studio_name: string | null;
    custom_client_statuses: string[] | null;
    final_invoice_visible_from_status: string | null;
    tracking_file_links_visible_from_status?: string | null;
    fastpik_link_display_mode: "both" | "prefer_fastpik" | "drive_only" | null;
    fastpik_link_display_mode_tracking?:
        | "both"
        | "prefer_fastpik"
        | "drive_only"
        | null;
};

export async function GET(request: NextRequest) {
    const uuid = request.nextUrl.searchParams.get("uuid");
    if (!uuid) {
        return NextResponse.json({ success: false, error: "uuid required" }, { status: 400 });
    }

    const { data: booking } = await supabaseAdmin
        .from("bookings")
        .select("id, user_id, booking_code, tracking_uuid, client_name, session_date, event_type, client_status, queue_position, status, drive_folder_url, fastpik_project_id, fastpik_project_link, fastpik_project_edit_link, fastpik_sync_status, fastpik_last_synced_at, total_price, dp_paid, is_fully_paid, settlement_status, final_adjustments, final_payment_amount, final_paid_at, final_invoice_sent_at, location, extra_fields, services(name), created_at")
        .eq("tracking_uuid", uuid)
        .single();

    if (!booking) {
        return NextResponse.json({ success: false, error: "Booking not found" }, { status: 404 });
    }

    const locale = request.nextUrl.searchParams.get("locale") || "id";
    const liveFastpikResult = await hydrateFastpikLiveData({
        supabase: supabaseAdmin,
        booking: booking as FastpikLiveBookingFields,
        locale,
    });
    const effectiveBooking = {
        ...booking,
        ...liveFastpikResult.booking,
    };

    let vendorName = "";
    let customClientStatuses: string[] | null = null;
    let finalInvoiceVisibleFromStatus: string | null = null;
    let trackingFileLinksVisibleFromStatus: string | null = null;
    let profileLinkMode: "both" | "prefer_fastpik" | "drive_only" =
        "prefer_fastpik";
    if (effectiveBooking?.user_id) {
        const { data: profileWithSplitMode, error: profileWithSplitModeError } = await supabaseAdmin
            .from("profiles")
            .select("studio_name, custom_client_statuses, final_invoice_visible_from_status, tracking_file_links_visible_from_status, fastpik_link_display_mode, fastpik_link_display_mode_tracking")
            .eq("id", effectiveBooking.user_id)
            .single();
        let v = profileWithSplitMode as ProfileTrackDisplayRow | null;
        if (!v && profileWithSplitModeError) {
            const { data: legacyProfile } = await supabaseAdmin
                .from("profiles")
                .select("studio_name, custom_client_statuses, final_invoice_visible_from_status, tracking_file_links_visible_from_status, fastpik_link_display_mode")
                .eq("id", effectiveBooking.user_id)
                .single();
            v = legacyProfile as ProfileTrackDisplayRow | null;
        }
        vendorName = v?.studio_name || "";
        customClientStatuses = (v?.custom_client_statuses as string[] | null) || null;
        finalInvoiceVisibleFromStatus = v?.final_invoice_visible_from_status || null;
        trackingFileLinksVisibleFromStatus =
            v?.tracking_file_links_visible_from_status || null;
        profileLinkMode = normalizeFastpikLinkDisplayMode(
            v?.fastpik_link_display_mode_tracking ??
                v?.fastpik_link_display_mode,
        );
    }

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

    return NextResponse.json({
        success: true,
        booking: {
            bookingCode: booking.booking_code,
            trackingUuid: effectiveBooking.tracking_uuid,
            clientName: effectiveBooking.client_name,
            sessionDate: effectiveBooking.session_date,
            eventType: effectiveBooking.event_type,
            clientStatus: effectiveClientStatus,
            queuePosition: effectiveBooking.queue_position,
            status: effectiveBooking.status,
            serviceName: (effectiveBooking.services as { name?: string } | null)?.name || null,
            fastpikUrl: effectiveBooking.fastpik_project_link,
            driveUrl: effectiveBooking.drive_folder_url,
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
        },
        vendorName,
    });
}
