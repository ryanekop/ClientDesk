import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { pushEventToCalendar } from "@/utils/google/calendar";
import { findOrCreateNestedPath, uploadFileToDrive, applyFolderTemplate } from "@/utils/google/drive";

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
            locationDetail,
            notes,
            extraData,
            paymentProofUrl,
            instagram,
        } = body;

        if (!vendorSlug || !clientName || !clientWhatsapp || !sessionDate || !serviceId) {
            return NextResponse.json({ success: false, error: "Data tidak lengkap." }, { status: 400 });
        }

        // Find vendor by slug
        const { data: vendor } = await supabaseAdmin
            .from("profiles")
            .select("id, studio_name, whatsapp_number, min_dp_percent, min_dp_map, google_access_token, google_refresh_token, google_drive_access_token, google_drive_refresh_token, drive_folder_format, calendar_event_format")
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

        // Generate booking code with sequential number
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, "0");
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const yyyy = now.getFullYear();

        // Count existing bookings for this vendor to get sequential number
        const { count: bookingCount } = await supabaseAdmin
            .from("bookings")
            .select("id", { count: "exact", head: true })
            .eq("user_id", vendor.id);
        const seq = String((bookingCount || 0) + 1).padStart(3, "0");
        const bookingCode = `INV-${dd}${mm}${yyyy}${seq}`;

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
                location_detail: locationDetail || null,
                notes: notes || null,
                extra_fields: extraData || null,
                payment_proof_url: paymentProofUrl || null,
                instagram: instagram || null,
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
                // Build event summary from template
                const eventFormat = (vendor as any).calendar_event_format || "📸 {{client_name}} — {{service_name}}";
                const templateVars: Record<string, string> = {
                    client_name: clientName,
                    service_name: service?.name || eventType || "Sesi Foto",
                    event_type: eventType || "-",
                    booking_code: bookingCode,
                    studio_name: vendor.studio_name || "Client Desk",
                };
                const summary = eventFormat.replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => templateVars[key] || `{{${key}}}`);

                await pushEventToCalendar(
                    vendor.google_access_token,
                    vendor.google_refresh_token,
                    {
                        summary,
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
        if (vendor.google_drive_access_token && vendor.google_drive_refresh_token && paymentProofUrl) {
            try {
                let mimeType = "image/jpeg";
                let buffer: Buffer;

                if (paymentProofUrl.startsWith("data:")) {
                    // Handle base64 data URI (legacy / edge case)
                    const matches = paymentProofUrl.match(/^data:(.+);base64,(.+)$/);
                    if (!matches) throw new Error("Invalid data URI");
                    mimeType = matches[1];
                    buffer = Buffer.from(matches[2], "base64");
                } else {
                    // Handle Supabase Storage URL — download the file first
                    const fileRes = await fetch(paymentProofUrl);
                    if (!fileRes.ok) throw new Error("Failed to download payment proof");
                    mimeType = fileRes.headers.get("content-type") || "image/jpeg";
                    const arrayBuffer = await fileRes.arrayBuffer();
                    buffer = Buffer.from(arrayBuffer);
                }

                const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : mimeType.includes("pdf") ? "pdf" : "jpg";
                const fileName = `${bookingCode}_${clientName.replace(/[^a-zA-Z0-9]/g, "_")}.${ext}`;

                // Build nested folder path: Data Booking Client Desk > Client Name > Booking Code
                const folderFormat = (vendor as any).drive_folder_format || "{client_name}";
                const clientFolderName = applyFolderTemplate(folderFormat, {
                    client_name: clientName,
                    booking_code: bookingCode,
                    event_type: eventType || "",
                });

                const folder = await findOrCreateNestedPath(
                    vendor.google_drive_access_token,
                    vendor.google_drive_refresh_token,
                    ["Data Booking Client Desk", clientFolderName, bookingCode]
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

                // Update booking with Drive URL (replace Supabase URL with Drive URL)
                if (uploaded.fileUrl) {
                    await supabaseAdmin
                        .from("bookings")
                        .update({ payment_proof_url: uploaded.fileUrl })
                        .eq("id", booking.id);

                    // Delete from Supabase Storage to save quota
                    if (paymentProofUrl && !paymentProofUrl.startsWith("data:")) {
                        try {
                            // Extract path from Supabase URL: .../storage/v1/object/public/payment-proofs/path/file.jpg
                            const urlObj = new URL(paymentProofUrl);
                            const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/payment-proofs\/(.+)/);
                            if (pathMatch) {
                                await supabaseAdmin.storage
                                    .from("payment-proofs")
                                    .remove([pathMatch[1]]);
                            }
                        } catch {
                            // Cleanup is best-effort
                        }
                    }
                }
            } catch {
                // Silently ignore — Drive upload is best-effort
                // Payment proof is still saved in Supabase Storage as fallback
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
