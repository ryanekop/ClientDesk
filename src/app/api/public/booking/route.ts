import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            vendorSlug,
            clientName,
            clientWhatsapp,
            eventType,
            sessionDate,
            serviceId,
            totalPrice,
            dpPaid,
            location,
            notes,
            extraData,
            paymentProofUrl,
        } = body;

        if (!vendorSlug || !clientName || !clientWhatsapp || !sessionDate || !serviceId) {
            return NextResponse.json({ success: false, error: "Data tidak lengkap." }, { status: 400 });
        }

        // Find vendor by slug
        const { data: vendor } = await supabaseAdmin
            .from("profiles")
            .select("id, studio_name, whatsapp_number, min_dp_percent")
            .eq("vendor_slug", vendorSlug)
            .single();

        if (!vendor) {
            return NextResponse.json({ success: false, error: "Vendor tidak ditemukan." }, { status: 404 });
        }

        // Validate minimum DP
        const minDP = vendor.min_dp_percent ?? 50;
        const minDPAmount = (totalPrice * minDP) / 100;
        if (dpPaid < minDPAmount) {
            return NextResponse.json({
                success: false,
                error: `Minimum DP adalah ${minDP}% (Rp ${new Intl.NumberFormat("id-ID").format(minDPAmount)}).`
            }, { status: 400 });
        }

        // Generate booking code
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, "0");
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const yyyy = now.getFullYear();
        const rand = String(Math.floor(Math.random() * 900) + 100);
        const bookingCode = `${dd}${mm}${yyyy}${rand}`;

        const { data: booking, error } = await supabaseAdmin
            .from("bookings")
            .insert({
                user_id: vendor.id,
                booking_code: bookingCode,
                client_name: clientName,
                client_whatsapp: clientWhatsapp,
                event_type: eventType || null,
                session_date: sessionDate,
                service_id: serviceId,
                total_price: totalPrice,
                dp_paid: dpPaid,
                location: location || null,
                notes: notes || null,
                extra_data: extraData || null,
                payment_proof_url: paymentProofUrl || null,
                status: "Pending",
                is_fully_paid: dpPaid >= totalPrice,
            })
            .select("id, booking_code")
            .single();

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            bookingCode: booking.booking_code,
            bookingId: booking.id,
            vendorWhatsapp: vendor.whatsapp_number,
            vendorName: vendor.studio_name,
        });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
