import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
    buildDriveFileHdUrl,
    deleteFileFromDrive,
    findOrCreateNestedPath,
    getDriveFilePublicLinks,
    uploadFileToDrive,
} from "@/utils/google/drive";

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { success: false, error: "Tidak terautentikasi." },
                { status: 401 },
            );
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("google_drive_access_token, google_drive_refresh_token, qris_drive_file_id, studio_name")
            .eq("id", user.id)
            .single();

        if (!profile?.google_drive_access_token || !profile?.google_drive_refresh_token) {
            return NextResponse.json(
                { success: false, error: "Google Drive belum terhubung." },
                { status: 400 },
            );
        }

        const formData = await request.formData();
        const file = formData.get("file");
        if (!(file instanceof File)) {
            return NextResponse.json(
                { success: false, error: "File QRIS tidak ditemukan." },
                { status: 400 },
            );
        }

        if (!file.type.startsWith("image/")) {
            return NextResponse.json(
                { success: false, error: "File QRIS harus berupa gambar." },
                { status: 400 },
            );
        }

        const ext = file.name.split(".").pop() || "png";
        const safeStudioName =
            (profile.studio_name || "studio")
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "") || "studio";
        const fileName = `qris-${safeStudioName}-${Date.now()}.${ext}`;

        const folder = await findOrCreateNestedPath(
            profile.google_drive_access_token,
            profile.google_drive_refresh_token,
            ["Data Booking Client Desk", "Pengaturan Pembayaran"],
        );

        if (!folder.folderId) {
            return NextResponse.json(
                { success: false, error: "Folder QRIS tidak dapat dibuat." },
                { status: 500 },
            );
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const uploaded = await uploadFileToDrive(
            profile.google_drive_access_token,
            profile.google_drive_refresh_token,
            fileName,
            file.type,
            buffer,
            folder.folderId,
        );

        if (!uploaded.fileId) {
            return NextResponse.json(
                { success: false, error: "Upload QRIS gagal." },
                { status: 500 },
            );
        }

        let qrisImageUrl = buildDriveFileHdUrl(uploaded.fileId);
        try {
            const publicLinks = await getDriveFilePublicLinks(
                profile.google_drive_access_token,
                profile.google_drive_refresh_token,
                uploaded.fileId,
            );
            qrisImageUrl = publicLinks.preferredUrl;
        } catch {
            // Keep the precomputed HD URL when Drive metadata cannot be refreshed.
        }

        await supabase
            .from("profiles")
            .update({
                qris_image_url: qrisImageUrl,
                qris_drive_file_id: uploaded.fileId,
            })
            .eq("id", user.id);

        if (profile.qris_drive_file_id && profile.qris_drive_file_id !== uploaded.fileId) {
            try {
                await deleteFileFromDrive(
                    profile.google_drive_access_token,
                    profile.google_drive_refresh_token,
                    profile.qris_drive_file_id,
                );
            } catch {
                // Best effort cleanup for old QRIS file.
            }
        }

        return NextResponse.json({
            success: true,
            qrisImageUrl,
            qrisDriveFileId: uploaded.fileId,
        });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Terjadi kesalahan saat upload QRIS.";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
