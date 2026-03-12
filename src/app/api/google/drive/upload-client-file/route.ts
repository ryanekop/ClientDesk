import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { findOrCreateNestedPath, uploadFileToDrive, applyFolderTemplate } from "@/utils/google/drive";

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ success: false, error: "Tidak terautentikasi" }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("google_drive_access_token, google_drive_refresh_token, drive_folder_format")
            .eq("id", user.id)
            .single();

        if (!profile?.google_drive_access_token || !profile?.google_drive_refresh_token) {
            return NextResponse.json({ success: false, error: "Google Drive belum terhubung." }, { status: 400 });
        }

        const formData = await request.formData();
        const bookingId = formData.get("bookingId") as string;
        const clientName = formData.get("clientName") as string;
        const bookingCode = formData.get("bookingCode") as string;
        const eventType = formData.get("eventType") as string;
        const file = formData.get("file") as File;

        if (!bookingId || !file) {
            return NextResponse.json({ success: false, error: "Data tidak lengkap." }, { status: 400 });
        }

        // Apply folder name template
        const folderFormat = (profile as any).drive_folder_format || "{client_name}";
        const clientFolderName = applyFolderTemplate(folderFormat, {
            client_name: clientName || "Client",
            booking_code: bookingCode || "",
            event_type: eventType || "",
        });

        // Create nested path: Data Booking Client Desk > Client Folder > File Client
        const folder = await findOrCreateNestedPath(
            profile.google_drive_access_token,
            profile.google_drive_refresh_token,
            ["Data Booking Client Desk", clientFolderName, "File Client"]
        );

        if (!folder.folderId) {
            return NextResponse.json({ success: false, error: "Gagal membuat folder." }, { status: 500 });
        }

        // Read file into buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload file to Drive
        const uploaded = await uploadFileToDrive(
            profile.google_drive_access_token,
            profile.google_drive_refresh_token,
            file.name,
            file.type || "application/octet-stream",
            buffer,
            folder.folderId
        );

        // Also save the client folder URL to booking's drive_folder_url if not set
        const { data: booking } = await supabase
            .from("bookings")
            .select("drive_folder_url")
            .eq("id", bookingId)
            .single();

        if (booking && !booking.drive_folder_url && folder.folderUrl) {
            // Save parent client folder URL (one level up)
            const parentFolder = await findOrCreateNestedPath(
                profile.google_drive_access_token,
                profile.google_drive_refresh_token,
                ["Data Booking Client Desk", clientFolderName]
            );
            if (parentFolder.folderUrl) {
                await supabase
                    .from("bookings")
                    .update({ drive_folder_url: parentFolder.folderUrl })
                    .eq("id", bookingId);
            }
        }

        return NextResponse.json({
            success: true,
            fileId: uploaded.fileId,
            fileUrl: uploaded.fileUrl,
            fileName: file.name,
            folderUrl: folder.folderUrl,
        });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
