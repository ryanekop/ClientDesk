import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { deleteFileFromDrive } from "@/utils/google/drive";

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ success: false, error: "Tidak terautentikasi" }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("google_drive_access_token, google_drive_refresh_token")
            .eq("id", user.id)
            .single();

        if (!profile?.google_drive_access_token || !profile?.google_drive_refresh_token) {
            return NextResponse.json({ success: false, error: "Google Drive belum terhubung." }, { status: 400 });
        }

        const { fileId } = await request.json();

        if (!fileId) {
            return NextResponse.json({ success: false, error: "File ID wajib diisi." }, { status: 400 });
        }

        await deleteFileFromDrive(
            profile.google_drive_access_token,
            profile.google_drive_refresh_token,
            fileId
        );

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
