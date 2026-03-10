import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { pushEventToCalendar } from "@/utils/google/calendar";
import { findOrCreateFolder, uploadFileToDrive } from "@/utils/google/drive";

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
            .select("id, studio_name, whatsapp_number, min_dp_percent, min_dp_map, google_access_token, google_refresh_token, google_drive_access_token, google_drive_refresh_token")
            .eq("vendor_slug", vendorSlug)
            .single();

        if (!vendor) {
            return NextResponse.json({ success: false, error: "Vendor tidak ditemukan." }, { status: 404 });
        }

        // Validate minimum DP (with per-event-type support)
        const dpMap = (typeof vendor.min_dp_map === "object" && vendor.min_dp_map !== null) ? vendor.min_dp_map as Record<string, number> : {};
        const minDP = (eventType && dpMap[eventType] !== undefined) ? dpMap[eventType] : (vendor.min_dp_percent ?? 50);
        const minDPAmount = (totalPrice * minDP) / 100;
        if (dpPaid < minDPAmount) {
            return NextResponse.json({
                success: false,
                error: `Minimum DP adalah ${minDP}% (Rp ${new Intl.NumberFormat("id-ID").format(minDPAmount)}).`
            }, { status: 400 });
        }

        // Get service name for calendar event
        const { data: service } = await supabaseAdmin
            .from("services")
            .select("name, duration_minutes")
            .eq("id", serviceId)
            .single();

        // Generate booking code
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, "0");
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const yyyy = now.getFullYear();
        const rand = String(Math.floor(Math.random() * 900) + 100);
        const bookingCode = `INV-${dd}${mm}${yyyy}${rand}`;

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
                extra_fields: extraData || null,
                payment_proof_url: paymentProofUrl || null,
                status: "Pending",
                is_fully_paid: dpPaid >= totalPrice,
            })
            .select("id, booking_code")
            .single();

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        // Auto-sync to Google Calendar (fire-and-forget)
        if (vendor.google_access_token && vendor.google_refresh_token && sessionDate) {
            try {
                const start = new Date(sessionDate);
                const durationMs = ((service?.duration_minutes || 120) * 60 * 1000);
                const end = new Date(start.getTime() + durationMs);
                await pushEventToCalendar(
                    vendor.google_access_token,
                    vendor.google_refresh_token,
                    {
                        summary: `📸 ${clientName} — ${service?.name || eventType || "Sesi Foto"}`,
                        description: `Kode: ${bookingCode}\nKlien: ${clientName}\nLokasi: ${location || "-"}\nTipe: ${eventType || "-"}`,
                        start,
                        end,
                    }
                );
            } catch {
                // Silently ignore — calendar may not be connected
            }
        }

        // Upload payment proof to vendor's Google Drive (fire-and-forget)
        if (vendor.google_drive_access_token && vendor.google_drive_refresh_token && paymentProofUrl && paymentProofUrl.startsWith("data:")) {
            try {
                // Parse base64 data URI
                const matches = paymentProofUrl.match(/^data:(.+);base64,(.+)$/);
                if (matches) {
                    const mimeType = matches[1];
                    const buffer = Buffer.from(matches[2], "base64");
                    const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
                    const fileName = `${bookingCode}_${clientName.replace(/[^a-zA-Z0-9]/g, "_")}.${ext}`;

                    // Find or create the parent folder
                    const folder = await findOrCreateFolder(
                        vendor.google_drive_access_token,
                        vendor.google_drive_refresh_token,
                        "Bukti Pembayaran Client Desk"
                    );

                    if (!folder.folderId) throw new Error("Folder creation failed");

                    // Upload file
                    const uploaded = await uploadFileToDrive(
                        vendor.google_drive_access_token,
                        vendor.google_drive_refresh_token,
                        fileName,
                        mimeType,
                        buffer,
                        folder.folderId
                    );

                    // Update booking with Drive URL
                    if (uploaded.fileUrl) {
                        await supabaseAdmin
                            .from("bookings")
                            .update({ payment_proof_url: uploaded.fileUrl })
                            .eq("id", booking.id);
                    }
                }
            } catch {
                // Silently ignore — Drive upload is best-effort
            }
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
