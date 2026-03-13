import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { deleteFileFromDrive } from "@/utils/google/drive";

export async function POST() {
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
            .select("google_drive_access_token, google_drive_refresh_token, qris_drive_file_id")
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
            } catch {
                // Best effort cleanup.
            }
        }

        await supabase
            .from("profiles")
            .update({
                qris_image_url: null,
                qris_drive_file_id: null,
            })
            .eq("id", user.id);

        return NextResponse.json({ success: true });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Terjadi kesalahan saat menghapus QRIS.";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
