import { NextRequest, NextResponse } from "next/server";
import { apiText } from "@/lib/i18n/api-errors";
import { createClient } from "@/utils/supabase/server";
import { deleteFileFromDrive } from "@/utils/google/drive";

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { success: false, error: apiText(request, "unauthorized") },
                { status: 401 },
            );
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("google_drive_access_token, google_drive_refresh_token")
            .eq("id", user.id)
            .single();

        if (!profile?.google_drive_access_token || !profile?.google_drive_refresh_token) {
            return NextResponse.json(
                { success: false, error: apiText(request, "driveNotConnected") },
                { status: 400 },
            );
        }

        const { fileId } = await request.json();

        if (!fileId) {
            return NextResponse.json(
                { success: false, error: apiText(request, "fileIdRequired") },
                { status: 400 },
            );
        }

        await deleteFileFromDrive(
            profile.google_drive_access_token,
            profile.google_drive_refresh_token,
            fileId
        );

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const message =
            err instanceof Error ? err.message : apiText(request, "failedDeleteFile");
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
