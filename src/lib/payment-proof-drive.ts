import {
  findOrCreateNestedPath,
  uploadFileToDrive,
  applyFolderTemplate,
} from "@/utils/google/drive";
import {
  DEFAULT_DRIVE_FOLDER_FORMAT,
  buildCalendarRangeFromLocalInput,
  resolveTemplateByEventType,
} from "@/utils/google/template";

type UploadPaymentProofArgs = {
  accessToken: string;
  refreshToken: string;
  driveFolderFormat: string | null;
  driveFolderFormatMap: Record<string, string> | null;
  studioName: string | null;
  bookingCode: string;
  clientName: string;
  eventType: string | null;
  sessionDate: string | null;
  fileName: string;
  mimeType: string;
  fileBuffer: Buffer;
  stage: "initial" | "final";
};

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

export async function uploadPaymentProofToDrive({
  accessToken,
  refreshToken,
  driveFolderFormat,
  driveFolderFormatMap,
  studioName,
  bookingCode,
  clientName,
  eventType,
  sessionDate,
  fileName,
  mimeType,
  fileBuffer,
  stage,
}: UploadPaymentProofArgs) {
  const folderFormat = resolveTemplateByEventType(
    driveFolderFormatMap,
    eventType,
    driveFolderFormat || DEFAULT_DRIVE_FOLDER_FORMAT,
  );
  const templateVars = {
    client_name: clientName,
    booking_code: bookingCode,
    event_type: eventType || "",
    studio_name: studioName || "Client Desk",
    ...(sessionDate
      ? buildCalendarRangeFromLocalInput(sessionDate, 0).templateVars
      : {}),
  };
  const clientFolderName = applyFolderTemplate(folderFormat, templateVars);
  const stageFolderName =
    stage === "final" ? "Bukti Pelunasan Final" : "Bukti Pembayaran Awal";
  const folder = await findOrCreateNestedPath(accessToken, refreshToken, [
    "Data Booking Client Desk",
    clientFolderName,
    bookingCode,
    stageFolderName,
  ]);

  if (!folder.folderId) {
    throw new Error("Folder Google Drive tidak berhasil dibuat.");
  }

  const uploaded = await uploadFileToDrive(
    accessToken,
    refreshToken,
    sanitizeFileName(fileName),
    mimeType,
    fileBuffer,
    folder.folderId,
  );

  return {
    fileId: uploaded.fileId || null,
    fileUrl: uploaded.fileUrl || null,
    folderUrl: folder.folderUrl || null,
  };
}
