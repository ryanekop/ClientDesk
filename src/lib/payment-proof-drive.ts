import {
  findOrCreateNestedPath,
  uploadFileToDrive,
} from "@/utils/google/drive";
import { buildDriveFolderPathSegments } from "@/lib/drive-folder-structure";

type UploadPaymentProofArgs = {
  accessToken: string;
  refreshToken: string;
  driveFolderFormat: string | null;
  driveFolderFormatMap: Record<string, string> | null;
  driveFolderStructureMap?: unknown;
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
  driveFolderStructureMap,
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
  const stageFolderName =
    stage === "final" ? "Bukti Pelunasan Final" : "Bukti Pembayaran Awal";
  const clientPathSegments = buildDriveFolderPathSegments({
    structureMap: driveFolderStructureMap,
    legacyFormat: driveFolderFormat,
    legacyFormatMap: driveFolderFormatMap,
    studioName,
    bookingCode,
    clientName,
    eventType,
    sessionDate,
  });
  const folder = await findOrCreateNestedPath(accessToken, refreshToken, [
    "Data Booking Client Desk",
    ...clientPathSegments,
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
