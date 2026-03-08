import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createBookingFolder } from "@/utils/google/drive";

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ success: false, error: "Tidak terautentikasi" }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("google_drive_access_token, google_drive_refresh_token, studio_name")
            .eq("id", user.id)
            .single();

        if (!profile?.google_drive_access_token || !profile?.google_drive_refresh_token) {
            return NextResponse.json({ success: false, error: "Google Drive belum terhubung." }, { status: 400 });
        }

        const { bookingId, folderName, parentId } = await request.json();

        if (!folderName) {
            return NextResponse.json({ success: false, error: "Nama folder wajib diisi." }, { status: 400 });
        }

        const result = await createBookingFolder(
            profile.google_drive_access_token,
            profile.google_drive_refresh_token,
            folderName,
            parentId || undefined
        );

        // If bookingId provided, save folder URL to booking
        if (bookingId && result.folderUrl) {
            await supabase
                .from("bookings")
                .update({ drive_folder_url: result.folderUrl })
                .eq("id", bookingId);
        }

        return NextResponse.json({
            success: true,
            folderId: result.folderId,
            folderUrl: result.folderUrl,
        });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
