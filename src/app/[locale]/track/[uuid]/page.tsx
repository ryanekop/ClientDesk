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
    shouldShowFinalInvoiceForClientStatus,
} from "@/lib/client-status";
import {
    normalizeFastpikLinkDisplayMode,
    type FastpikLinkDisplayMode,
} from "@/lib/fastpik-link-display";
import { resolveSpecialOfferSnapshotFromExtraFields } from "@/lib/booking-special-offer";

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
    services: { name: string } | null;
};

type ProfileRow = {
    studio_name: string | null;
    custom_client_statuses: string[] | null;
    final_invoice_visible_from_status: string | null;
    fastpik_link_display_mode: FastpikLinkDisplayMode | null;
    fastpik_link_display_mode_tracking?: FastpikLinkDisplayMode | null;
};

async function getBookingData(uuid: string) {
    const { data: booking } = await supabaseAdmin
        .from("bookings")
        .select("id, booking_code, tracking_uuid, client_name, session_date, event_type, client_status, queue_position, status, drive_folder_url, fastpik_project_link, total_price, dp_paid, is_fully_paid, settlement_status, final_adjustments, final_payment_amount, final_paid_at, final_invoice_sent_at, location, extra_fields, user_id, services(name), created_at")
        .eq("tracking_uuid", uuid)
        .single() as { data: BookingRow | null; error: unknown };

    if (!booking) return null;

    let vendorName = "";
    let customClientStatuses: string[] | null = null;
    let finalInvoiceVisibleFromStatus: string | null = null;
    let fastpikLinkDisplayMode: FastpikLinkDisplayMode = "prefer_fastpik";
    if (booking.user_id) {
        const { data: profileWithSplitMode, error: profileWithSplitModeError } = await supabaseAdmin
            .from("profiles")
            .select("studio_name, custom_client_statuses, final_invoice_visible_from_status, fastpik_link_display_mode, fastpik_link_display_mode_tracking")
            .eq("id", booking.user_id)
            .single();
        let profile = profileWithSplitMode as ProfileRow | null;
        if (!profile && profileWithSplitModeError) {
            const { data: legacyProfile } = await supabaseAdmin
                .from("profiles")
                .select("studio_name, custom_client_statuses, final_invoice_visible_from_status, fastpik_link_display_mode")
                .eq("id", booking.user_id)
                .single();
            profile = legacyProfile as ProfileRow | null;
        }
        vendorName = profile?.studio_name || "";
        customClientStatuses = profile?.custom_client_statuses || null;
        finalInvoiceVisibleFromStatus = profile?.final_invoice_visible_from_status || null;
        fastpikLinkDisplayMode = normalizeFastpikLinkDisplayMode(
            profile?.fastpik_link_display_mode_tracking ??
                profile?.fastpik_link_display_mode,
        );
    }

    return {
        booking,
        vendorName,
        customClientStatuses,
        finalInvoiceVisibleFromStatus,
        fastpikLinkDisplayMode,
    };
}

// ── Dynamic metadata for SEO & WhatsApp link previews ──────────────────────
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { uuid } = await params;
    const result = await getBookingData(uuid);

    if (!result) {
        return { title: "Booking Not Found" };
    }

    const { booking, vendorName } = result;
    const status = resolveUnifiedBookingStatus({
        status: booking.status,
        clientStatus: booking.client_status,
        statuses: result.customClientStatuses,
    });
    const title = `${status} — ${booking.client_name} — ${booking.booking_code}`;
    const description = `Tracking booking ${booking.booking_code} untuk ${booking.client_name}${vendorName ? ` di ${vendorName}` : ""}`;

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            type: "website",
        },
    };
}

// ── Page — Server Component ───────────────────────────────────────────────────
export default async function TrackingPage({ params }: PageProps) {
    const { uuid } = await params;
    const result = await getBookingData(uuid);

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

    const { booking, vendorName, customClientStatuses, finalInvoiceVisibleFromStatus } = result;
    const finalAdjustments = normalizeFinalAdjustments(booking.final_adjustments);
    const specialOffer = resolveSpecialOfferSnapshotFromExtraFields(booking.extra_fields);
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

    const bookingData = {
        bookingCode: booking.booking_code,
        trackingUuid: booking.tracking_uuid,
        clientName: booking.client_name,
        sessionDate: booking.session_date,
        eventType: booking.event_type,
        clientStatus: effectiveClientStatus,
        queuePosition: booking.queue_position,
        status: booking.status,
        serviceName: (booking.services as { name?: string } | null)?.name || null,
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
        showFinalInvoice: shouldShowFinalInvoiceForClientStatus({
            statuses: customClientStatuses,
            currentStatus: effectiveClientStatus,
            visibleFromStatus: finalInvoiceVisibleFromStatus,
        }),
    };

    return <TrackingClient booking={bookingData} vendorName={vendorName} customStatuses={customClientStatuses} />;
}
