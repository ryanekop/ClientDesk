import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
    getFinalAdjustmentsTotal,
    getFinalInvoiceTotal,
    getRemainingFinalPayment,
    normalizeFinalAdjustments,
} from "@/lib/final-settlement";
import { shouldShowFinalInvoiceForClientStatus } from "@/lib/client-status";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
    const uuid = request.nextUrl.searchParams.get("uuid");
    if (!uuid) {
        return NextResponse.json({ success: false, error: "uuid required" }, { status: 400 });
    }

    const { data: booking } = await supabaseAdmin
        .from("bookings")
        .select("id, booking_code, tracking_uuid, client_name, session_date, event_type, client_status, queue_position, status, drive_folder_url, total_price, dp_paid, is_fully_paid, settlement_status, final_adjustments, final_payment_amount, final_paid_at, final_invoice_sent_at, location, services(name), created_at")
        .eq("tracking_uuid", uuid)
        .single();

    if (!booking) {
        return NextResponse.json({ success: false, error: "Booking not found" }, { status: 404 });
    }

    // Get vendor name
    const { data: bookingOwner } = await supabaseAdmin
        .from("bookings")
        .select("user_id")
        .eq("id", booking.id)
        .single();

    let vendorName = "";
    let customClientStatuses: string[] | null = null;
    let finalInvoiceVisibleFromStatus: string | null = null;
    if (bookingOwner?.user_id) {
        const { data: v } = await supabaseAdmin
            .from("profiles")
            .select("studio_name, custom_client_statuses, final_invoice_visible_from_status")
            .eq("id", bookingOwner.user_id)
            .single();
        vendorName = v?.studio_name || "";
        customClientStatuses = (v?.custom_client_statuses as string[] | null) || null;
        finalInvoiceVisibleFromStatus = v?.final_invoice_visible_from_status || null;
    }

    const finalAdjustments = normalizeFinalAdjustments(booking.final_adjustments);
    const effectiveClientStatus = booking.status || booking.client_status || "Pending";

    return NextResponse.json({
        success: true,
        booking: {
            bookingCode: booking.booking_code,
            trackingUuid: booking.tracking_uuid,
            clientName: booking.client_name,
            sessionDate: booking.session_date,
            eventType: booking.event_type,
            clientStatus: effectiveClientStatus,
            queuePosition: booking.queue_position,
            status: booking.status,
            serviceName: (booking.services as { name?: string } | null)?.name || null,
            driveUrl: booking.drive_folder_url,
            createdAt: booking.created_at,
            totalPrice: booking.total_price || 0,
            dpPaid: booking.dp_paid || 0,
            isFullyPaid: booking.is_fully_paid || false,
            settlementStatus: booking.settlement_status || "draft",
            finalAdjustmentsTotal: getFinalAdjustmentsTotal(finalAdjustments),
            finalInvoiceTotal: getFinalInvoiceTotal(booking.total_price || 0, finalAdjustments),
            remainingFinalPayment: getRemainingFinalPayment({
                total_price: booking.total_price || 0,
                dp_paid: booking.dp_paid || 0,
                final_adjustments: finalAdjustments,
                final_payment_amount: booking.final_payment_amount || 0,
                final_paid_at: booking.final_paid_at,
                settlement_status: booking.settlement_status,
                is_fully_paid: booking.is_fully_paid || false,
            }),
            finalInvoiceSentAt: booking.final_invoice_sent_at || null,
            location: booking.location || null,
            showFinalInvoice: shouldShowFinalInvoiceForClientStatus({
                statuses: customClientStatuses,
                currentStatus: effectiveClientStatus,
                visibleFromStatus: finalInvoiceVisibleFromStatus,
            }),
        },
        vendorName,
    });
}
