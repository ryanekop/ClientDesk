import { NextRequest, NextResponse } from "next/server";

import {
  assertBookingWriteAccessForUser,
  BookingWriteAccessDeniedError,
} from "@/lib/booking-write-access.server";
import { apiText } from "@/lib/i18n/api-errors";
import { uploadPaymentProofToDrive } from "@/lib/payment-proof-drive";
import { invalidatePublicCachesForBooking } from "@/lib/public-cache-invalidation";
import { requireRouteUser } from "@/lib/pagination/route-user";
import { deleteFileFromDrive } from "@/utils/google/drive";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_PROOF_TYPES = new Set(["application/pdf"]);

type BookingProofStage = "initial" | "final";

type BookingProofRow = {
  id: string;
  booking_code: string;
  tracking_uuid: string | null;
  client_name: string;
  event_type: string | null;
  session_date: string | null;
  extra_fields: Record<string, unknown> | null;
  payment_proof_drive_file_id: string | null;
  final_payment_proof_drive_file_id: string | null;
};

type BookingProfileRow = {
  form_show_proof: boolean | null;
  google_drive_access_token: string | null;
  google_drive_refresh_token: string | null;
  drive_folder_format: string | null;
  drive_folder_format_map: Record<string, string> | null;
  drive_folder_structure_map: Record<string, string[] | string> | null;
  studio_name: string | null;
};

function isValidStage(value: FormDataEntryValue | null): value is BookingProofStage {
  return value === "initial" || value === "final";
}

function isAcceptedProofFile(file: File) {
  return file.type.startsWith("image/") || ACCEPTED_PROOF_TYPES.has(file.type);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { errorResponse, supabase, user } = await requireRouteUser();
    if (errorResponse || !user) {
      return errorResponse;
    }

    await assertBookingWriteAccessForUser(user.id);

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: apiText(request, "bookingNotFound") },
        { status: 400 },
      );
    }

    const formData = await request.formData();
    const stageValue = formData.get("stage");
    const fileValue = formData.get("file");

    if (!isValidStage(stageValue)) {
      return NextResponse.json(
        { success: false, error: apiText(request, "invalidProofStage") },
        { status: 400 },
      );
    }

    if (!(fileValue instanceof File) || fileValue.size <= 0) {
      return NextResponse.json(
        { success: false, error: apiText(request, "paymentProofRequired") },
        { status: 400 },
      );
    }

    if (fileValue.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: apiText(request, "maxFile5mb") },
        { status: 400 },
      );
    }

    if (!isAcceptedProofFile(fileValue)) {
      return NextResponse.json(
        { success: false, error: apiText(request, "unsupportedProofFormat") },
        { status: 400 },
      );
    }

    const [{ data: booking, error: bookingError }, { data: profile, error: profileError }] =
      await Promise.all([
        supabase
          .from("bookings")
          .select(
            "id, booking_code, tracking_uuid, client_name, event_type, session_date, extra_fields, payment_proof_drive_file_id, final_payment_proof_drive_file_id",
          )
          .eq("id", id)
          .eq("user_id", user.id)
          .maybeSingle<BookingProofRow>(),
        supabase
          .from("profiles")
          .select(
            "form_show_proof, google_drive_access_token, google_drive_refresh_token, drive_folder_format, drive_folder_format_map, drive_folder_structure_map, studio_name",
          )
          .eq("id", user.id)
          .maybeSingle<BookingProfileRow>(),
      ]);

    if (bookingError) {
      return NextResponse.json(
        { success: false, error: bookingError.message || apiText(request, "failedLoadBooking") },
        { status: 500 },
      );
    }

    if (!booking) {
      return NextResponse.json(
        { success: false, error: apiText(request, "bookingNotFound") },
        { status: 404 },
      );
    }

    if (profileError) {
      return NextResponse.json(
        { success: false, error: profileError.message || apiText(request, "failedLoadProfile") },
        { status: 500 },
      );
    }

    if ((profile?.form_show_proof ?? true) === false) {
      return NextResponse.json(
        { success: false, error: apiText(request, "paymentProofDisabled") },
        { status: 400 },
      );
    }

    if (
      !profile?.google_drive_access_token ||
      !profile?.google_drive_refresh_token
    ) {
      return NextResponse.json(
        { success: false, error: apiText(request, "driveNotConnected") },
        { status: 400 },
      );
    }

    const fileBuffer = Buffer.from(await fileValue.arrayBuffer());
    const uploaded = await uploadPaymentProofToDrive({
      accessToken: profile.google_drive_access_token,
      refreshToken: profile.google_drive_refresh_token,
      driveFolderFormat: profile.drive_folder_format,
      driveFolderFormatMap: profile.drive_folder_format_map,
      driveFolderStructureMap: profile.drive_folder_structure_map,
      studioName: profile.studio_name,
      bookingCode: booking.booking_code,
      clientName: booking.client_name,
      eventType: booking.event_type,
      sessionDate: booking.session_date,
      extraFields: booking.extra_fields,
      fileName:
        fileValue.name ||
        `${booking.booking_code}_${stageValue === "final" ? "final_payment_proof" : "payment_proof"}`,
      mimeType: fileValue.type || "application/octet-stream",
      fileBuffer,
      stage: stageValue,
    });

    const previousFileId =
      stageValue === "final"
        ? booking.final_payment_proof_drive_file_id
        : booking.payment_proof_drive_file_id;
    const updatePayload =
      stageValue === "final"
        ? {
            final_payment_proof_url: uploaded.fileUrl,
            final_payment_proof_drive_file_id: uploaded.fileId,
          }
        : {
            payment_proof_url: uploaded.fileUrl,
            payment_proof_drive_file_id: uploaded.fileId,
          };
    const { error: updateError } = await supabase
      .from("bookings")
      .update(updatePayload)
      .eq("id", booking.id)
      .eq("user_id", user.id);

    if (updateError) {
      if (uploaded.fileId) {
        try {
          await deleteFileFromDrive(
            profile.google_drive_access_token,
            profile.google_drive_refresh_token,
            uploaded.fileId,
          );
        } catch {
          // Best effort cleanup for newly uploaded file.
        }
      }

      return NextResponse.json(
        { success: false, error: updateError.message || apiText(request, "failedSavePaymentProof") },
        { status: 500 },
      );
    }

    if (
      previousFileId &&
      uploaded.fileId &&
      previousFileId !== uploaded.fileId
    ) {
      try {
        await deleteFileFromDrive(
          profile.google_drive_access_token,
          profile.google_drive_refresh_token,
          previousFileId,
        );
      } catch {
        // Best effort cleanup for replaced file.
      }
    }

    invalidatePublicCachesForBooking({
      bookingCode: booking.booking_code,
      trackingUuid: booking.tracking_uuid,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      stage: stageValue,
      proofUrl: uploaded.fileUrl,
      driveFileId: uploaded.fileId,
    });
  } catch (error) {
    if (error instanceof BookingWriteAccessDeniedError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }

    const message =
      error instanceof Error ? error.message : apiText(request, "failedUploadPaymentProof");
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
