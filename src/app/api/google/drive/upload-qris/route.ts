import { NextRequest, NextResponse } from "next/server";
import { apiText } from "@/lib/i18n/api-errors";
import { createClient } from "@/utils/supabase/server";
import {
    buildDriveFileHdUrl,
    deleteFileFromDrive,
    findOrCreateNestedPath,
    getDriveFilePublicLinks,
    uploadFileToDrive,
} from "@/utils/google/drive";
import { invalidatePublicCachesForProfile } from "@/lib/public-cache-invalidation";
import { clearGoogleDriveConnection } from "@/lib/google-calendar-reauth";
import {
    buildGoogleInvalidGrantPayload,
    isGoogleInvalidGrantError,
} from "@/lib/google-oauth-error";

export async function POST(request: NextRequest) {
    let userId: string | null = null;
    let supabase: Awaited<ReturnType<typeof createClient>> | null = null;
    try {
        supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { success: false, error: apiText(request, "unauthorized") },
                { status: 401 },
            );
        }
        userId = user.id;

        const { data: profile } = await supabase
            .from("profiles")
            .select("google_drive_access_token, google_drive_refresh_token, qris_drive_file_id, studio_name, vendor_slug")
            .eq("id", user.id)
            .single();

        if (!profile?.google_drive_access_token || !profile?.google_drive_refresh_token) {
            return NextResponse.json(
                { success: false, error: apiText(request, "driveNotConnected") },
                { status: 400 },
            );
        }

        const formData = await request.formData();
        const file = formData.get("file");
        if (!(file instanceof File)) {
            return NextResponse.json(
                { success: false, error: apiText(request, "qrisFileNotFound") },
                { status: 400 },
            );
        }

        if (!file.type.startsWith("image/")) {
            return NextResponse.json(
                { success: false, error: apiText(request, "qrisImageOnly") },
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
            ["Data Booking Client Desk", "Payment Settings"],
        );

        if (!folder.folderId) {
            return NextResponse.json(
                { success: false, error: apiText(request, "failedCreateFolder") },
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
                { success: false, error: apiText(request, "failedUploadFile") },
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

        const { error: updateError } = await supabase
            .from("profiles")
            .update({
                qris_image_url: qrisImageUrl,
                qris_drive_file_id: uploaded.fileId,
            })
            .eq("id", user.id);
        if (updateError) {
            return NextResponse.json(
                { success: false, error: updateError.message || apiText(request, "failedSaveProfile") },
                { status: 500 },
            );
        }

        invalidatePublicCachesForProfile({
            userId: user.id,
            vendorSlug: profile?.vendor_slug || null,
        });

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
        if (userId && supabase && isGoogleInvalidGrantError(error)) {
            await clearGoogleDriveConnection(supabase, userId);
            return NextResponse.json(
                { success: false, ...buildGoogleInvalidGrantPayload("drive") },
                { status: 403 },
            );
        }

        const message =
            error instanceof Error ? error.message : apiText(request, "failedUploadFile");
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
