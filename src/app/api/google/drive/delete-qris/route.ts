import { NextRequest, NextResponse } from "next/server";
import { apiText } from "@/lib/i18n/api-errors";
import { createClient } from "@/utils/supabase/server";
import { deleteFileFromDrive } from "@/utils/google/drive";
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
            .select("google_drive_access_token, google_drive_refresh_token, qris_drive_file_id, vendor_slug")
            .eq("id", user.id)
            .single();

        if (
            profile?.google_drive_access_token &&
            profile?.google_drive_refresh_token &&
            profile?.qris_drive_file_id
        ) {
            try {
                await deleteFileFromDrive(
                    profile.google_drive_access_token,
                    profile.google_drive_refresh_token,
                    profile.qris_drive_file_id,
                );
            } catch (error) {
                if (isGoogleInvalidGrantError(error)) {
                    await clearGoogleDriveConnection(supabase, user.id);
                    return NextResponse.json(
                        { success: false, ...buildGoogleInvalidGrantPayload("drive") },
                        { status: 403 },
                    );
                }

                // Best effort cleanup.
            }
        }

        const { error: updateError } = await supabase
            .from("profiles")
            .update({
                qris_image_url: null,
                qris_drive_file_id: null,
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

        return NextResponse.json({ success: true });
    } catch (error) {
        if (userId && supabase && isGoogleInvalidGrantError(error)) {
            await clearGoogleDriveConnection(supabase, userId);
            return NextResponse.json(
                { success: false, ...buildGoogleInvalidGrantPayload("drive") },
                { status: 403 },
            );
        }

        const message =
            error instanceof Error ? error.message : apiText(request, "failedDeleteQris");
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
