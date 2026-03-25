import { NextRequest, NextResponse } from "next/server";
import {
    assertBookingWriteAccessForUser,
    BookingWriteAccessDeniedError,
} from "@/lib/booking-write-access.server";
import { apiText } from "@/lib/i18n/api-errors";
import { createClient } from "@/utils/supabase/server";
import { createBookingFolder, findOrCreateNestedPath } from "@/utils/google/drive";
import { buildDriveFolderPathSegments } from "@/lib/drive-folder-structure";

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

        await assertBookingWriteAccessForUser(user.id);

        const { data: profile } = await supabase
            .from("profiles")
            .select("google_drive_access_token, google_drive_refresh_token, studio_name, drive_folder_format, drive_folder_format_map, drive_folder_structure_map")
            .eq("id", user.id)
            .single();

        if (!profile?.google_drive_access_token || !profile?.google_drive_refresh_token) {
            return NextResponse.json(
                { success: false, error: apiText(request, "driveNotConnected") },
                { status: 400 },
            );
        }

        const { bookingId, folderName, parentId, bookingCode, clientName } = await request.json();

        const resolvedFolderName = typeof folderName === "string" ? folderName.trim() : "";
        let bookingContext: {
            bookingCode: string;
            clientName: string;
            eventType: string | null;
            sessionDate: string | null;
            extraFields: unknown;
        } | null = null;

        if (bookingId) {
            const { data: booking } = await supabase
                .from("bookings")
                .select("booking_code, client_name, event_type, session_date, extra_fields")
                .eq("id", bookingId)
                .single();
            if (booking) {
                bookingContext = {
                    bookingCode: booking.booking_code,
                    clientName: booking.client_name,
                    eventType: booking.event_type,
                    sessionDate: booking.session_date,
                    extraFields: booking.extra_fields,
                };
            }
        }

        if (!resolvedFolderName && !bookingContext && (!bookingCode || !clientName)) {
            return NextResponse.json(
                { success: false, error: apiText(request, "folderNameRequired") },
                { status: 400 },
            );
        }

        const result = bookingContext || (bookingCode && clientName)
            ? await findOrCreateNestedPath(
                profile.google_drive_access_token,
                profile.google_drive_refresh_token,
                [
                    "Data Booking Client Desk",
                    ...buildDriveFolderPathSegments({
                        structureMap: profile.drive_folder_structure_map,
                        legacyFormat: profile.drive_folder_format,
                        legacyFormatMap: profile.drive_folder_format_map,
                        studioName: profile.studio_name,
                        bookingCode: bookingContext?.bookingCode || bookingCode,
                        clientName: bookingContext?.clientName || clientName,
                        eventType: bookingContext?.eventType || null,
                        sessionDate: bookingContext?.sessionDate || null,
                        extraFields: bookingContext?.extraFields,
                    }),
                ],
            )
            : await createBookingFolder(
                profile.google_drive_access_token,
                profile.google_drive_refresh_token,
                resolvedFolderName,
                parentId || undefined,
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
    } catch (err: unknown) {
        if (err instanceof BookingWriteAccessDeniedError) {
            return NextResponse.json(
                { success: false, error: err.message },
                { status: err.status },
            );
        }
        const message =
            err instanceof Error ? err.message : apiText(request, "failedCreateFolder");
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
