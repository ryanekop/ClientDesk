import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
        .select("id, booking_code, client_name, session_date, event_type, client_status, queue_position, status, drive_folder_url, services(name), created_at")
        .eq("tracking_uuid", uuid)
        .single();

    if (!booking) {
        return NextResponse.json({ success: false, error: "Booking not found" }, { status: 404 });
    }

    // Get vendor name
    const { data: profile } = await supabaseAdmin
        .from("bookings")
        .select("user_id")
        .eq("id", booking.id)
        .single();

    let vendorName = "";
    if (profile?.user_id) {
        const { data: v } = await supabaseAdmin.from("profiles").select("studio_name").eq("id", profile.user_id).single();
        vendorName = v?.studio_name || "";
    }

    return NextResponse.json({
        success: true,
        booking: {
            bookingCode: booking.booking_code,
            clientName: booking.client_name,
            sessionDate: booking.session_date,
            eventType: booking.event_type,
            clientStatus: booking.client_status,
            queuePosition: booking.queue_position,
            status: booking.status,
            serviceName: (booking.services as any)?.name || null,
            driveUrl: booking.drive_folder_url,
            createdAt: booking.created_at,
        },
        vendorName,
    });
}
