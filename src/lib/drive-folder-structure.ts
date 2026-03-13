import {
  DEFAULT_DRIVE_FOLDER_FORMAT,
  DEFAULT_DRIVE_FOLDER_STRUCTURE,
  buildCalendarRangeFromLocalInput,
  normalizeDriveFolderStructureMap,
  resolveDriveFolderStructureByEventType,
  resolveTemplateByEventType,
} from "@/utils/google/template";
import { applyFolderTemplate } from "@/utils/google/drive";

type BuildDrivePathArgs = {
  structureMap?: unknown;
  legacyFormat?: string | null;
  legacyFormatMap?: Record<string, string> | null;
  studioName?: string | null;
  bookingCode: string;
  clientName: string;
  eventType?: string | null;
  sessionDate?: string | null;
};

export function normalizeDriveFolderStructureSettings(
  structureMap: unknown,
  legacyFormat?: string | null,
  legacyFormatMap?: Record<string, string> | null,
) {
  const normalized = normalizeDriveFolderStructureMap(structureMap);

  if (normalized.Umum.length > 0) {
    return normalized;
  }

  const fallbackFormat = resolveTemplateByEventType(
    legacyFormatMap,
    "Umum",
    legacyFormat || DEFAULT_DRIVE_FOLDER_FORMAT,
  );
  return normalizeDriveFolderStructureMap(
    { Umum: [fallbackFormat] },
    DEFAULT_DRIVE_FOLDER_STRUCTURE,
  );
}

export function buildDriveFolderTemplateVars({
  studioName,
  bookingCode,
  clientName,
  eventType,
  sessionDate,
}: Omit<BuildDrivePathArgs, "structureMap" | "legacyFormat" | "legacyFormatMap">) {
  return {
    client_name: clientName,
    booking_code: bookingCode,
    event_type: eventType || "",
    studio_name: studioName || "Client Desk",
    ...(sessionDate
      ? buildCalendarRangeFromLocalInput(sessionDate, 0).templateVars
      : {}),
  };
}

export function buildDriveFolderPathSegments({
  structureMap,
  legacyFormat,
  legacyFormatMap,
  studioName,
  bookingCode,
  clientName,
  eventType,
  sessionDate,
}: BuildDrivePathArgs): string[] {
  const normalized = normalizeDriveFolderStructureSettings(
    structureMap,
    legacyFormat,
    legacyFormatMap,
  );
  const rawSegments = resolveDriveFolderStructureByEventType(
    normalized,
    eventType,
    DEFAULT_DRIVE_FOLDER_STRUCTURE,
  );
  const vars = buildDriveFolderTemplateVars({
    studioName,
    bookingCode,
    clientName,
    eventType,
    sessionDate,
  });

  return rawSegments
    .map((segment) => applyFolderTemplate(segment, vars).trim())
    .filter((segment) => segment.length > 0);
}
