import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import * as XLSX from "xlsx";
import {
  DEFAULT_CLIENT_STATUSES,
  getBookingStatusOptions,
  getInitialBookingStatus,
} from "@/lib/client-status";
import {
  getActiveEventTypes,
  normalizeEventTypeList,
  normalizeEventTypeName,
  isShowAllPackagesEventType,
} from "@/lib/event-type-config";
import { EVENT_EXTRA_FIELDS } from "@/utils/form-extra-fields";
import { parseSessionDateParts } from "@/utils/format-date";
import {
  buildUniversityDisplayName,
  cleanUniversityName,
  matchesUniversityDisplayValue,
  normalizeUniversityAbbreviation,
  normalizeUniversityName,
  UNIVERSITY_EVENT_TYPE,
  UNIVERSITY_EXTRA_FIELD_KEY,
  UNIVERSITY_REFERENCE_EXTRA_KEY,
} from "@/lib/university-references";
import {
  computeSpecialOfferTotal,
  buildEditableSpecialOfferSnapshot,
  mergeSpecialOfferSnapshotIntoExtraFields,
} from "@/lib/booking-special-offer";
import type {
  ImportContext,
  ImportCustomFieldDefinition,
  ImportCustomFieldType,
  ImportIssue,
  ImportPreviewRow,
  ImportReportFile,
  ImportCommitRowResult,
  ImportServiceRow,
  ImportValidationResult,
  NormalizedImportRow,
} from "@/lib/bookings-import/types";

export const IMPORT_MAX_ROWS = 500;

export const IMPORT_COLUMNS = {
  externalImportId: "external_import_id",
  clientName: "client_name",
  clientWhatsapp: "client_whatsapp",
  instagram: "instagram",
  eventType: "event_type",
  mainServices: "main_services",
  mainServiceIds: "main_service_ids",
  sessionDate: "session_date",
  sessionTime: "session_time",
  akadDate: "akad_date",
  resepsiDate: "resepsi_date",
  wisudaSession1Date: "wisuda_session_1_date",
  wisudaSession2Date: "wisuda_session_2_date",
  dpPaid: "dp_paid",
  status: "status",
  addonServices: "addon_services",
  addonServiceIds: "addon_service_ids",
  freelancers: "freelancers",
  freelanceIds: "freelance_ids",
  location: "location",
  locationDetail: "location_detail",
  bookingDate: "booking_date",
  notes: "notes",
  adminNotes: "admin_notes",
  accommodationFee: "accommodation_fee",
  discountAmount: "discount_amount",
} as const;

const REQUIRED_TEMPLATE_COLUMNS = [
  IMPORT_COLUMNS.clientName,
  IMPORT_COLUMNS.eventType,
  IMPORT_COLUMNS.mainServices,
  IMPORT_COLUMNS.mainServiceIds,
  IMPORT_COLUMNS.sessionDate,
  IMPORT_COLUMNS.akadDate,
  IMPORT_COLUMNS.resepsiDate,
  IMPORT_COLUMNS.wisudaSession1Date,
  IMPORT_COLUMNS.wisudaSession2Date,
  IMPORT_COLUMNS.dpPaid,
];

const BUILT_IN_SECTION_TITLES: Record<
  "client_info" | "session_details" | "payment_details",
  string
> = {
  client_info: "Informasi Klien",
  session_details: "Detail Sesi",
  payment_details: "Paket Pembayaran",
};

type ProfileImportRow = {
  custom_client_statuses?: string[] | null;
  form_sections?: unknown;
  form_event_types?: string[] | null;
  custom_event_types?: unknown;
};

type ServiceImportRow = {
  id: string;
  name: string;
  price: number | string | null;
  is_addon?: boolean | null;
  event_types?: string[] | null;
  sort_order?: number | null;
};

type FreelancerImportRow = {
  id: string;
  name: string;
};

type UniversityReferenceLookupRow = {
  id: string;
  name: string;
  abbreviation: string | null;
  normalized_name: string;
  normalized_abbreviation: string | null;
};

type ValidationOptions = {
  fileNamePrefix: string;
};

function normalizeText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  return "";
}

function normalizeNullableText(value: unknown): string | null {
  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeCsvLikeValues(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/\r?\n|[|,]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function normalizeMoneyNumber(rawValue: string): number | null {
  const raw = rawValue.trim();
  if (!raw) return null;

  const stripped = raw.replace(/[^0-9,.-]/g, "");
  if (!stripped) return null;

  let normalized = stripped;
  if (normalized.includes(".") && normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(/,/g, ".");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(/,/g, ".");
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function parseNonNegativeMoney(
  value: unknown,
  fieldName: string,
  issues: ImportIssue[],
  options?: { required?: boolean },
): { value: number; hasInput: boolean } {
  const normalized = normalizeText(value);
  if (!normalized) {
    if (options?.required) {
      issues.push({ level: "error", message: `${fieldName} wajib diisi.` });
    }
    return { value: 0, hasInput: false };
  }

  const parsed = normalizeMoneyNumber(normalized);
  if (parsed === null) {
    issues.push({ level: "error", message: `${fieldName} harus berupa angka.` });
    return { value: 0, hasInput: true };
  }
  if (parsed < 0) {
    issues.push({ level: "error", message: `${fieldName} tidak boleh negatif.` });
    return { value: 0, hasInput: true };
  }

  return { value: parsed, hasInput: true };
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function isValidDateParts(year: number, month: number, day: number) {
  const parsed = parseSessionDateParts(
    `${year}-${pad2(month)}-${pad2(day)}T00:00`,
  );
  return Boolean(parsed);
}

function parseExcelDateCode(value: number) {
  const parsed = XLSX.SSF.parse_date_code(value);
  if (!parsed) return null;
  const year = Number(parsed.y || 0);
  const month = Number(parsed.m || 0);
  const day = Number(parsed.d || 0);
  const hours = Number(parsed.H || 0);
  const minutes = Number(parsed.M || 0);

  if (!isValidDateParts(year, month, day)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return { year, month, day, hours, minutes };
}

function parseFlexibleDateValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = parseExcelDateCode(value);
    if (!parsed) return null;
    return { year: parsed.year, month: parsed.month, day: parsed.day };
  }

  const raw = normalizeText(value);
  if (!raw) return null;

  const dateToken = raw.split(/[T\s]+/).filter(Boolean)[0] || raw;

  if (/^\d+(\.\d+)?$/.test(dateToken)) {
    const numeric = Number(dateToken);
    if (Number.isFinite(numeric)) {
      const parsed = parseExcelDateCode(numeric);
      if (parsed) {
        return { year: parsed.year, month: parsed.month, day: parsed.day };
      }
    }
  }

  const normalized = dateToken.replace(/[.]/g, "-").replace(/\//g, "-");
  let match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    return isValidDateParts(year, month, day) ? { year, month, day } : null;
  }

  match = normalized.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  return isValidDateParts(year, month, day) ? { year, month, day } : null;
}

function parseFlexibleTimeValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 0 && value < 1) {
      const parsed = parseExcelDateCode(value);
      if (parsed) return { hours: parsed.hours, minutes: parsed.minutes };
    }
    if (value >= 100 && value <= 2359) {
      const text = String(Math.floor(value));
      const normalized = text.padStart(4, "0");
      const hours = Number(normalized.slice(0, 2));
      const minutes = Number(normalized.slice(2, 4));
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        return { hours, minutes };
      }
    }
  }

  const raw = normalizeText(value);
  if (!raw) return null;

  let match = raw.match(/^(\d{1,2})[:.](\d{1,2})$/);
  if (match) {
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return { hours, minutes };
    }
    return null;
  }

  match = raw.match(/^(\d{3,4})$/);
  if (!match) return null;

  const normalized = match[1].padStart(4, "0");
  const hours = Number(normalized.slice(0, 2));
  const minutes = Number(normalized.slice(2, 4));
  if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
    return { hours, minutes };
  }
  return null;
}

function parseFlexibleDateTimeValue(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = parseExcelDateCode(value);
    if (!parsed) return null;
    const normalized = `${parsed.year}-${pad2(parsed.month)}-${pad2(
      parsed.day,
    )}T${pad2(parsed.hours)}:${pad2(parsed.minutes)}`;
    return parseSessionDateParts(normalized) ? normalized : null;
  }

  const raw = normalizeText(value);
  if (!raw) return null;

  if (/^\d+(\.\d+)?$/.test(raw)) {
    const numeric = Number(raw);
    if (Number.isFinite(numeric)) {
      const parsed = parseExcelDateCode(numeric);
      if (parsed) {
        const normalized = `${parsed.year}-${pad2(parsed.month)}-${pad2(
          parsed.day,
        )}T${pad2(parsed.hours)}:${pad2(parsed.minutes)}`;
        return parseSessionDateParts(normalized) ? normalized : null;
      }
    }
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const normalized = `${raw}T10:00`;
    return parseSessionDateParts(normalized) ? normalized : null;
  }

  if (/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}$/.test(raw)) {
    const normalized = raw.replace(" ", "T");
    return parseSessionDateParts(normalized) ? normalized : null;
  }

  if (/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}$/.test(raw)) {
    const normalized = raw.replace(" ", "T").slice(0, 16);
    return parseSessionDateParts(normalized) ? normalized : null;
  }

  const splitParts = raw.split(/[T\s]+/).filter(Boolean);
  const datePart = parseFlexibleDateValue(splitParts[0] || "");
  if (!datePart) return null;
  const timePart = parseFlexibleTimeValue(splitParts[1] || "10:00") || {
    hours: 10,
    minutes: 0,
  };
  const normalized = `${datePart.year}-${pad2(datePart.month)}-${pad2(
    datePart.day,
  )}T${pad2(timePart.hours)}:${pad2(timePart.minutes)}`;
  return parseSessionDateParts(normalized) ? normalized : null;
}

function normalizeSessionDateInput(value: unknown): string | null {
  return parseFlexibleDateTimeValue(value);
}

function normalizeBookingDateInput(value: unknown): string | null {
  const parsed = parseFlexibleDateValue(value);
  if (!parsed) return null;
  const normalized = `${parsed.year}-${pad2(parsed.month)}-${pad2(parsed.day)}`;
  return parseSessionDateParts(`${normalized}T00:00`) ? normalized : null;
}

function combineSessionDateAndTime(input: {
  sessionDate: string | null;
  sessionTimeRaw: unknown;
}): { value: string | null; usedTime: boolean; invalidTime: boolean } {
  if (!input.sessionDate) {
    return { value: null, usedTime: false, invalidTime: false };
  }

  const sessionTimeRaw = normalizeText(input.sessionTimeRaw);
  if (!sessionTimeRaw) {
    return { value: input.sessionDate, usedTime: false, invalidTime: false };
  }

  const parsedTime = parseFlexibleTimeValue(input.sessionTimeRaw);
  if (!parsedTime) {
    return { value: input.sessionDate, usedTime: false, invalidTime: true };
  }

  const [datePart] = input.sessionDate.split("T");
  const normalized = `${datePart}T${pad2(parsedTime.hours)}:${pad2(parsedTime.minutes)}`;
  return {
    value: parseSessionDateParts(normalized) ? normalized : input.sessionDate,
    usedTime: true,
    invalidTime: false,
  };
}

function normalizeWhatsappValue(value: unknown): string | null {
  const raw = normalizeText(value);
  if (!raw) return null;

  let digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return null;

  if (digits.startsWith("0")) {
    digits = `62${digits.slice(1)}`;
  } else if (!digits.startsWith("62")) {
    digits = `62${digits}`;
  }

  const normalizedDigits = digits.replace(/^62+/, "62");
  if (normalizedDigits.length < 8) return null;
  return `+${normalizedDigits}`;
}

function normalizeStatusInput(value: unknown, statusOptions: string[]): string | null {
  const raw = normalizeText(value);
  if (!raw) return null;
  const matched = statusOptions.find(
    (item) => item.toLowerCase() === raw.toLowerCase(),
  );
  return matched || null;
}

function normalizeEventTypeInput(value: unknown, eventTypes: string[]): string | null {
  const normalized = normalizeEventTypeName(value);
  if (!normalized) return null;
  return eventTypes.includes(normalized) ? normalized : null;
}

function getTemplateHeaders(context: ImportContext): string[] {
  const baseHeaders = [
    IMPORT_COLUMNS.clientName,
    IMPORT_COLUMNS.clientWhatsapp,
    IMPORT_COLUMNS.instagram,
    IMPORT_COLUMNS.eventType,
    IMPORT_COLUMNS.mainServices,
    IMPORT_COLUMNS.mainServiceIds,
    IMPORT_COLUMNS.sessionDate,
    IMPORT_COLUMNS.sessionTime,
    IMPORT_COLUMNS.akadDate,
    IMPORT_COLUMNS.resepsiDate,
    IMPORT_COLUMNS.wisudaSession1Date,
    IMPORT_COLUMNS.wisudaSession2Date,
    IMPORT_COLUMNS.dpPaid,
    IMPORT_COLUMNS.status,
    IMPORT_COLUMNS.addonServices,
    IMPORT_COLUMNS.addonServiceIds,
    IMPORT_COLUMNS.freelancers,
    IMPORT_COLUMNS.freelanceIds,
    IMPORT_COLUMNS.location,
    IMPORT_COLUMNS.locationDetail,
    IMPORT_COLUMNS.bookingDate,
    IMPORT_COLUMNS.notes,
    IMPORT_COLUMNS.adminNotes,
    IMPORT_COLUMNS.accommodationFee,
    IMPORT_COLUMNS.discountAmount,
  ];

  const extraHeaders = context.extraFieldUnion.map((field) => `extra.${field.key}`);
  const customHeaders = context.customFieldUnion.map((field) => `cf.${field.id}`);

  return [...baseHeaders, ...extraHeaders, ...customHeaders];
}

function normalizeHeaderToken(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function resolveExtraHeaderAlias(normalizedToken: string) {
  const aliases: Record<string, string> = {
    universitas: "extra.universitas",
    fakultas: "extra.fakultas",
    tempat_akad: "extra.tempat_akad",
    tempat_resepsi: "extra.tempat_resepsi",
    tempat_wisuda_1: "extra.tempat_wisuda_1",
    tempat_wisuda_2: "extra.tempat_wisuda_2",
  };
  return aliases[normalizedToken] || null;
}

function resolveHeaderAlias(
  normalizedToken: string,
): keyof typeof IMPORT_COLUMNS | null {
  const aliases: Record<string, keyof typeof IMPORT_COLUMNS> = {
    nama_klien: "clientName",
    client: "clientName",
    nama_client: "clientName",
    nomor_whatsapp: "clientWhatsapp",
    nomor_wa: "clientWhatsapp",
    wa: "clientWhatsapp",
    wa_klien: "clientWhatsapp",
    whatsapp: "clientWhatsapp",
    event: "eventType",
    jenis_acara: "eventType",
    paket: "mainServices",
    paket_layanan: "mainServices",
    add_on: "addonServices",
    addon: "addonServices",
    tanggal: "sessionDate",
    jadwal: "sessionDate",
    tanggal_sesi: "sessionDate",
    jam: "sessionTime",
    jam_sesi: "sessionTime",
    waktu: "sessionTime",
    waktu_sesi: "sessionTime",
    tanggal_booking: "bookingDate",
    catatan: "notes",
    catatan_admin: "adminNotes",
    lokasi_detail: "locationDetail",
  };
  return aliases[normalizedToken] || null;
}

function normalizePasteRows(rawRows: unknown): string[][] {
  if (!Array.isArray(rawRows)) return [];

  return rawRows
    .filter((row) => Array.isArray(row))
    .map((row) =>
      (row as unknown[]).map((cell) =>
        typeof cell === "string"
          ? cell.trim()
          : cell === null || cell === undefined
            ? ""
            : String(cell).trim(),
      ),
    )
    .filter((row) => row.some((cell) => cell.length > 0));
}

function detectHeaderFromFirstRow(
  firstRow: string[],
  templateHeaderLookup: Map<string, string>,
) {
  const nonEmptyCells = firstRow.filter((cell) => cell.trim().length > 0);
  if (nonEmptyCells.length === 0) return false;

  const matchCount = nonEmptyCells.reduce((sum, cell) => {
    const token = normalizeHeaderToken(cell);
    if (templateHeaderLookup.has(token)) return sum + 1;
    const aliasKey = resolveHeaderAlias(token);
    if (aliasKey && templateHeaderLookup.has(IMPORT_COLUMNS[aliasKey])) {
      return sum + 1;
    }
    return sum;
  }, 0);

  const threshold = Math.min(3, nonEmptyCells.length);
  return matchCount >= threshold;
}

export function buildWorkbookBufferFromPasteRows(input: {
  context: ImportContext;
  rows: unknown;
  hasHeader?: boolean | null;
}) {
  const templateHeaders = getTemplateHeaders(input.context);
  const templateHeaderLookup = new Map(
    templateHeaders.map((header) => [normalizeHeaderToken(header), header]),
  );

  const rows = normalizePasteRows(input.rows);
  if (rows.length === 0) {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet([]),
      "Bookings",
    );
    return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
  }

  const shouldTreatFirstRowAsHeader =
    typeof input.hasHeader === "boolean"
      ? input.hasHeader
      : detectHeaderFromFirstRow(rows[0], templateHeaderLookup);

  const headerRow = shouldTreatFirstRowAsHeader ? rows[0] : templateHeaders;
  const dataRows = shouldTreatFirstRowAsHeader ? rows.slice(1) : rows;

  const resolvedHeaders = headerRow.map((headerCell, index) => {
    const normalizedToken = normalizeHeaderToken(headerCell);
    const direct = templateHeaderLookup.get(normalizedToken);
    if (direct) return direct;

    const extraAlias = resolveExtraHeaderAlias(normalizedToken);
    if (extraAlias && templateHeaderLookup.has(normalizeHeaderToken(extraAlias))) {
      return extraAlias;
    }

    const aliasKey = resolveHeaderAlias(normalizedToken);
    if (aliasKey) return IMPORT_COLUMNS[aliasKey];

    return headerCell.trim() || templateHeaders[index] || `column_${index + 1}`;
  });

  const sheetRows = dataRows.map((row) => {
    const record = Object.fromEntries(
      templateHeaders.map((header) => [header, ""]),
    ) as Record<string, string>;

    row.forEach((value, index) => {
      const key = resolvedHeaders[index];
      if (!key) return;
      record[key] = value;
    });

    return record;
  });

  const workbook = XLSX.utils.book_new();
  const bookingsSheet = XLSX.utils.json_to_sheet(sheetRows);
  XLSX.utils.book_append_sheet(workbook, bookingsSheet, "Bookings");

  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
}

function sampleValueFromLabel(label: string) {
  const trimmed = label.trim();
  return trimmed ? `Contoh ${trimmed}` : "Contoh";
}

function fillRequiredExtraFields(
  row: Record<string, string | number>,
  eventType: string,
) {
  const defs = EVENT_EXTRA_FIELDS[eventType] || [];
  for (const field of defs) {
    if (!field.required) continue;
    row[`extra.${field.key}`] = field.isNumeric ? "0" : sampleValueFromLabel(field.label);
  }
}

function fillRequiredCustomFields(
  row: Record<string, string | number>,
  customFields: ImportCustomFieldDefinition[],
) {
  for (const field of customFields) {
    if (!field.required) continue;
    const key = `cf.${field.id}`;

    if (field.type === "number") {
      row[key] = "1";
      continue;
    }

    if ((field.type === "select" || field.type === "checkbox") && field.options.length > 0) {
      row[key] = field.options[0];
      continue;
    }

    row[key] = sampleValueFromLabel(field.label);
  }
}

function buildTemplateSampleRows(
  context: ImportContext,
  headers: string[],
): Array<Record<string, string | number>> {
  const nonWeddingEventType =
    context.eventTypeOptions.find((item) => item.toLowerCase() !== "wedding") ||
    context.eventTypeOptions[0] ||
    "Umum";
  const weddingEventType = context.eventTypeOptions.find(
    (item) => item.toLowerCase() === "wedding",
  );
  const wisudaEventType = context.eventTypeOptions.find(
    (item) => item.toLowerCase() === "wisuda",
  );

  const baseRow = Object.fromEntries(headers.map((header) => [header, ""])) as Record<
    string,
    string | number
  >;

  const nonWeddingMainService =
    context.mainServices.find((service) =>
      isServiceAvailableForEvent(service, nonWeddingEventType),
    ) || context.mainServices[0];
  const nonWeddingAddonService =
    context.addonServices.find((service) =>
      isServiceAvailableForEvent(service, nonWeddingEventType),
    ) || context.addonServices[0];
  const sampleFreelancer = context.freelancers[0];

  const row1 = {
    ...baseRow,
    [IMPORT_COLUMNS.clientName]: "CONTOH - Nama Klien Reguler",
    [IMPORT_COLUMNS.clientWhatsapp]: "+6281234567890",
    [IMPORT_COLUMNS.instagram]: "@klien.reguler",
    [IMPORT_COLUMNS.eventType]: nonWeddingEventType,
    [IMPORT_COLUMNS.mainServices]: nonWeddingMainService?.name || "",
    [IMPORT_COLUMNS.mainServiceIds]: "",
    [IMPORT_COLUMNS.sessionDate]: "2026-07-15",
    [IMPORT_COLUMNS.sessionTime]: "10:00",
    [IMPORT_COLUMNS.akadDate]: "",
    [IMPORT_COLUMNS.resepsiDate]: "",
    [IMPORT_COLUMNS.dpPaid]: "1000000",
    [IMPORT_COLUMNS.status]: context.initialStatus,
    [IMPORT_COLUMNS.addonServices]: nonWeddingAddonService?.name || "",
    [IMPORT_COLUMNS.addonServiceIds]: "",
    [IMPORT_COLUMNS.freelancers]: sampleFreelancer?.name || "",
    [IMPORT_COLUMNS.freelanceIds]: "",
    [IMPORT_COLUMNS.location]: "Contoh Lokasi 1",
    [IMPORT_COLUMNS.locationDetail]: "Gedung A Lt.2",
    [IMPORT_COLUMNS.bookingDate]: "2026-07-01",
    [IMPORT_COLUMNS.notes]: "Contoh catatan booking reguler.",
    [IMPORT_COLUMNS.adminNotes]: "",
    [IMPORT_COLUMNS.accommodationFee]: "0",
    [IMPORT_COLUMNS.discountAmount]: "0",
  };

  fillRequiredExtraFields(row1, nonWeddingEventType);
  fillRequiredCustomFields(
    row1,
    context.customFieldsByEventType[nonWeddingEventType] ||
      context.customFieldsByEventType.Umum ||
      [],
  );

  const rows: Array<Record<string, string | number>> = [row1];

  if (weddingEventType) {
    const weddingMainService =
      context.mainServices.find((service) =>
        isServiceAvailableForEvent(service, weddingEventType),
      ) || context.mainServices[0];
    const weddingAddonService =
      context.addonServices.find((service) =>
        isServiceAvailableForEvent(service, weddingEventType),
      ) || context.addonServices[0];

    const row2 = {
      ...baseRow,
      [IMPORT_COLUMNS.clientName]: "CONTOH - Nama Klien Wedding",
      [IMPORT_COLUMNS.clientWhatsapp]: "+6281298765432",
      [IMPORT_COLUMNS.instagram]: "@klien.wedding",
      [IMPORT_COLUMNS.eventType]: weddingEventType,
      [IMPORT_COLUMNS.mainServices]: weddingMainService?.name || "",
      [IMPORT_COLUMNS.mainServiceIds]: "",
      [IMPORT_COLUMNS.sessionDate]: "",
      [IMPORT_COLUMNS.sessionTime]: "",
      [IMPORT_COLUMNS.akadDate]: "2026-08-20T09:00",
      [IMPORT_COLUMNS.resepsiDate]: "2026-08-20T18:00",
      [IMPORT_COLUMNS.dpPaid]: "1500000",
      [IMPORT_COLUMNS.status]: context.initialStatus,
      [IMPORT_COLUMNS.addonServices]: weddingAddonService?.name || "",
      [IMPORT_COLUMNS.addonServiceIds]: "",
      [IMPORT_COLUMNS.freelancers]: sampleFreelancer?.name || "",
      [IMPORT_COLUMNS.freelanceIds]: "",
      [IMPORT_COLUMNS.location]: "Contoh Lokasi Wedding",
      [IMPORT_COLUMNS.locationDetail]: "Hall Utama",
      [IMPORT_COLUMNS.bookingDate]: "2026-08-01",
      [IMPORT_COLUMNS.notes]: "Contoh booking wedding split session.",
      [IMPORT_COLUMNS.adminNotes]: "",
      [IMPORT_COLUMNS.accommodationFee]: "0",
      [IMPORT_COLUMNS.discountAmount]: "0",
    };

    fillRequiredExtraFields(row2, weddingEventType);
    fillRequiredCustomFields(
      row2,
      context.customFieldsByEventType[weddingEventType] ||
        context.customFieldsByEventType.Umum ||
        [],
    );

    rows.push(row2);
  }

  if (wisudaEventType) {
    const wisudaMainService =
      context.mainServices.find((service) =>
        isServiceAvailableForEvent(service, wisudaEventType),
      ) || context.mainServices[0];
    const wisudaAddonService =
      context.addonServices.find((service) =>
        isServiceAvailableForEvent(service, wisudaEventType),
      ) || context.addonServices[0];

    const row3 = {
      ...baseRow,
      [IMPORT_COLUMNS.clientName]: "CONTOH - Nama Klien Wisuda Split",
      [IMPORT_COLUMNS.clientWhatsapp]: "+6281377788899",
      [IMPORT_COLUMNS.instagram]: "@klien.wisuda",
      [IMPORT_COLUMNS.eventType]: wisudaEventType,
      [IMPORT_COLUMNS.mainServices]: wisudaMainService?.name || "",
      [IMPORT_COLUMNS.mainServiceIds]: "",
      [IMPORT_COLUMNS.sessionDate]: "",
      [IMPORT_COLUMNS.sessionTime]: "",
      [IMPORT_COLUMNS.akadDate]: "",
      [IMPORT_COLUMNS.resepsiDate]: "",
      [IMPORT_COLUMNS.wisudaSession1Date]: "2026-09-10T07:30",
      [IMPORT_COLUMNS.wisudaSession2Date]: "2026-09-10T13:00",
      [IMPORT_COLUMNS.dpPaid]: "1000000",
      [IMPORT_COLUMNS.status]: context.initialStatus,
      [IMPORT_COLUMNS.addonServices]: wisudaAddonService?.name || "",
      [IMPORT_COLUMNS.addonServiceIds]: "",
      [IMPORT_COLUMNS.freelancers]: sampleFreelancer?.name || "",
      [IMPORT_COLUMNS.freelanceIds]: "",
      [IMPORT_COLUMNS.location]: "Contoh Lokasi Wisuda",
      [IMPORT_COLUMNS.locationDetail]: "Area Kampus",
      [IMPORT_COLUMNS.bookingDate]: "2026-09-01",
      [IMPORT_COLUMNS.notes]: "Contoh booking wisuda split sesi.",
      [IMPORT_COLUMNS.adminNotes]: "",
      [IMPORT_COLUMNS.accommodationFee]: "0",
      [IMPORT_COLUMNS.discountAmount]: "0",
      "extra.tempat_wisuda_1": "Balairung Kampus",
      "extra.tempat_wisuda_2": "Taman Wisuda",
    };

    fillRequiredExtraFields(row3, wisudaEventType);
    fillRequiredCustomFields(
      row3,
      context.customFieldsByEventType[wisudaEventType] ||
        context.customFieldsByEventType.Umum ||
        [],
    );

    rows.push(row3);
  }

  return rows;
}

function compareServices(a: ImportServiceRow, b: ImportServiceRow) {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.name.localeCompare(b.name);
}

function normalizeServicePrice(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function isServiceAvailableForEvent(service: ImportServiceRow, eventType: string) {
  if (!eventType) return false;
  if (isShowAllPackagesEventType(eventType)) return true;
  if (!service.eventTypes || service.eventTypes.length === 0) return true;
  const normalized = normalizeEventTypeName(eventType);
  if (!normalized) return false;
  return service.eventTypes.some(
    (item) => normalizeEventTypeName(item) === normalized,
  );
}

function sectionIdFromLegacy(
  raw: unknown,
): "client_info" | "session_details" | "payment_details" {
  const id = normalizeText((raw as { id?: unknown } | null)?.id);
  if (id === "builtin-client-info") return "client_info";
  if (id === "builtin-payment-details") return "payment_details";
  return "session_details";
}

function toCustomFieldType(value: unknown): ImportCustomFieldType {
  if (
    value === "text" ||
    value === "textarea" ||
    value === "number" ||
    value === "select" ||
    value === "checkbox"
  ) {
    return value;
  }
  return "text";
}

function parseCustomFieldsFromNewLayout(
  layout: unknown[],
): ImportCustomFieldDefinition[] {
  const fields: ImportCustomFieldDefinition[] = [];
  let currentSection: "client_info" | "session_details" | "payment_details" =
    "client_info";

  for (const rawItem of layout) {
    if (!rawItem || typeof rawItem !== "object") continue;
    const item = rawItem as Record<string, unknown>;
    const kind = normalizeText(item.kind);

    if (kind === "builtin_section") {
      const sectionId = normalizeText(item.sectionId);
      if (
        sectionId === "client_info" ||
        sectionId === "session_details" ||
        sectionId === "payment_details"
      ) {
        currentSection = sectionId;
      }
      continue;
    }

    if (kind !== "custom_field") continue;
    if (item.hidden === true) continue;

    const id = normalizeText(item.id);
    const label = normalizeText(item.label);
    if (!id || !label) continue;

    const options = Array.isArray(item.options)
      ? item.options.filter((option): option is string => typeof option === "string")
      : [];

    fields.push({
      id,
      label,
      type: toCustomFieldType(item.type),
      required: Boolean(item.required),
      options,
      sectionId: currentSection,
      sectionTitle: BUILT_IN_SECTION_TITLES[currentSection],
    });
  }

  return fields;
}

function parseCustomFieldsFromLegacyLayout(
  layout: unknown[],
): ImportCustomFieldDefinition[] {
  const fields: ImportCustomFieldDefinition[] = [];

  for (const rawSection of layout) {
    if (!rawSection || typeof rawSection !== "object") continue;
    const section = rawSection as Record<string, unknown>;
    const sectionId = sectionIdFromLegacy(section);
    const rawFields = Array.isArray(section.fields) ? section.fields : [];

    for (const rawField of rawFields) {
      if (!rawField || typeof rawField !== "object") continue;
      const field = rawField as Record<string, unknown>;
      const id = normalizeText(field.id);
      const label = normalizeText(field.label);
      if (!id || !label) continue;

      const options = Array.isArray(field.options)
        ? field.options.filter((option): option is string => typeof option === "string")
        : [];

      fields.push({
        id,
        label,
        type: toCustomFieldType(field.type),
        required: Boolean(field.required),
        options,
        sectionId,
        sectionTitle: BUILT_IN_SECTION_TITLES[sectionId],
      });
    }
  }

  return fields;
}

function extractCustomFieldsByEventType(
  rawSections: unknown,
  eventTypes: string[],
): Record<string, ImportCustomFieldDefinition[]> {
  const normalized: Record<string, ImportCustomFieldDefinition[]> = {};

  if (Array.isArray(rawSections)) {
    normalized.Umum = dedupeCustomFields(parseCustomFieldsFromLayout(rawSections));
  } else if (rawSections && typeof rawSections === "object") {
    for (const [eventTypeKey, rawLayout] of Object.entries(
      rawSections as Record<string, unknown>,
    )) {
      const normalizedEventType = normalizeEventTypeName(eventTypeKey) || eventTypeKey;
      if (!Array.isArray(rawLayout)) continue;
      normalized[normalizedEventType] = dedupeCustomFields(
        parseCustomFieldsFromLayout(rawLayout),
      );
    }
  }

  if (!normalized.Umum) {
    normalized.Umum = [];
  }

  for (const eventType of eventTypes) {
    if (!normalized[eventType]) {
      normalized[eventType] = normalized.Umum;
    }
  }

  return normalized;
}

function parseCustomFieldsFromLayout(layout: unknown[]): ImportCustomFieldDefinition[] {
  const hasKindShape = layout.some(
    (item) => Boolean(item) && typeof item === "object" && "kind" in (item as Record<string, unknown>),
  );
  if (hasKindShape) {
    return parseCustomFieldsFromNewLayout(layout);
  }
  return parseCustomFieldsFromLegacyLayout(layout);
}

function dedupeCustomFields(
  fields: ImportCustomFieldDefinition[],
): ImportCustomFieldDefinition[] {
  const seen = new Set<string>();
  const deduped: ImportCustomFieldDefinition[] = [];
  for (const field of fields) {
    if (seen.has(field.id)) continue;
    seen.add(field.id);
    deduped.push(field);
  }
  return deduped;
}

function buildCustomFieldUnion(
  customFieldsByEventType: Record<string, ImportCustomFieldDefinition[]>,
  eventTypes: string[],
): ImportCustomFieldDefinition[] {
  const seen = new Set<string>();
  const union: ImportCustomFieldDefinition[] = [];

  const keys = Array.from(new Set(["Umum", ...eventTypes]));
  for (const key of keys) {
    for (const field of customFieldsByEventType[key] || []) {
      if (seen.has(field.id)) continue;
      seen.add(field.id);
      union.push(field);
    }
  }

  return union;
}

function buildExtraFieldUnion(eventTypes: string[]) {
  const seen = new Set<string>();
  const union: Array<{ key: string; label: string; required: boolean; isNumeric: boolean }> = [];

  for (const eventType of eventTypes) {
    const fields = EVENT_EXTRA_FIELDS[eventType] || [];
    for (const field of fields) {
      if (seen.has(field.key)) continue;
      seen.add(field.key);
      union.push({
        key: field.key,
        label: field.label,
        required: Boolean(field.required),
        isNumeric: Boolean(field.isNumeric),
      });
    }
  }

  return union;
}

export async function loadImportContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ context: ImportContext | null; error: string | null }> {
  const [{ data: profile, error: profileError }, { data: services, error: servicesError }, { data: freelancers, error: freelancersError }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("custom_client_statuses, form_sections, form_event_types, custom_event_types")
        .eq("id", userId)
        .single(),
      supabase
        .from("services")
        .select("id, name, price, is_addon, event_types, sort_order")
        .eq("user_id", userId)
        .eq("is_active", true)
        .eq("is_public", true),
      supabase
        .from("freelance")
        .select("id, name")
        .eq("user_id", userId)
        .eq("status", "active"),
    ]);

  if (profileError || !profile) {
    return { context: null, error: profileError?.message || "Gagal memuat profil import." };
  }

  if (servicesError) {
    return { context: null, error: servicesError.message || "Gagal memuat layanan." };
  }

  if (freelancersError) {
    return { context: null, error: freelancersError.message || "Gagal memuat freelance." };
  }

  const profileRow = profile as ProfileImportRow;
  const statusOptions = getBookingStatusOptions(
    (profileRow.custom_client_statuses as string[] | null | undefined) ||
      DEFAULT_CLIENT_STATUSES,
  );
  const eventTypeOptions = getActiveEventTypes({
    customEventTypes: normalizeEventTypeList(profileRow.custom_event_types),
    activeEventTypes: profileRow.form_event_types,
  });

  const serviceRows = ((services || []) as ServiceImportRow[])
    .map((service) => ({
      id: service.id,
      name: service.name,
      price: normalizeServicePrice(service.price),
      isAddon: Boolean(service.is_addon),
      eventTypes: normalizeEventTypeList(service.event_types),
      sortOrder:
        typeof service.sort_order === "number" ? service.sort_order : Number.MAX_SAFE_INTEGER,
    }))
    .sort(compareServices);

  const mainServices = serviceRows.filter((service) => !service.isAddon);
  const addonServices = serviceRows.filter((service) => service.isAddon);

  const freelancerRows = ((freelancers || []) as FreelancerImportRow[])
    .map((item) => ({ id: item.id, name: item.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const customFieldsByEventType = extractCustomFieldsByEventType(
    profileRow.form_sections,
    eventTypeOptions,
  );
  const customFieldUnion = buildCustomFieldUnion(
    customFieldsByEventType,
    eventTypeOptions,
  );
  const extraFieldUnion = buildExtraFieldUnion(eventTypeOptions);

  return {
    context: {
      userId,
      statusOptions,
      initialStatus: getInitialBookingStatus(statusOptions),
      eventTypeOptions,
      mainServices,
      addonServices,
      freelancers: freelancerRows,
      customFieldsByEventType,
      customFieldUnion,
      extraFieldUnion,
    },
    error: null,
  };
}

export function buildTemplateWorkbookBuffer(context: ImportContext): Buffer {
  const headers = getTemplateHeaders(context);
  const sampleRows = buildTemplateSampleRows(context, headers);
  const rows = [
    headers,
    ...sampleRows.map((row) => headers.map((header) => row[header] ?? "")),
  ];
  const bookingsSheet = XLSX.utils.aoa_to_sheet(rows);

  bookingsSheet["!cols"] = headers.map((header) => ({
    wch: Math.max(header.length + 2, 18),
  }));

  const lookupsRows: (string | number)[][] = [
    ["lookup_type", "key", "name", "id", "meta"],
    ...context.eventTypeOptions.map((item) => ["event_type", item, item, "", ""]),
    ...context.statusOptions.map((item) => ["status", item, item, "", ""]),
    ...context.mainServices.map((item) => [
      "main_service",
      item.name,
      item.name,
      item.id,
      item.eventTypes.length > 0 ? item.eventTypes.join(" | ") : "Semua event",
    ]),
    ...context.addonServices.map((item) => [
      "addon_service",
      item.name,
      item.name,
      item.id,
      item.eventTypes.length > 0 ? item.eventTypes.join(" | ") : "Semua event",
    ]),
    ...context.freelancers.map((item) => ["freelancer", item.name, item.name, item.id, ""]),
    ...context.extraFieldUnion.map((item) => [
      "extra_field",
      `extra.${item.key}`,
      item.label,
      "",
      `${item.required ? "required" : "optional"}${item.isNumeric ? "; numeric" : ""}`,
    ]),
    ...context.customFieldUnion.map((item) => [
      "custom_field",
      `cf.${item.id}`,
      item.label,
      item.id,
      `${item.sectionTitle}; ${item.type}; ${item.required ? "required" : "optional"}${
        item.options.length > 0 ? `; options: ${item.options.join(" | ")}` : ""
      }`,
    ]),
  ];
  const lookupsSheet = XLSX.utils.aoa_to_sheet(lookupsRows);
  lookupsSheet["!cols"] = [
    { wch: 18 },
    { wch: 24 },
    { wch: 28 },
    { wch: 40 },
    { wch: 46 },
  ];

  const guideRows = [
    ["Batch Import Excel v2 - Guide"],
    ["1. Wajib isi: client_name, event_type, dp_paid, dan salah satu main_services/main_service_ids."],
    ["2. client_whatsapp akan dinormalisasi ke format +62XXXXXXXXXXX saat validasi."],
    ["3. Date format fleksibel: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, atau serial Excel."],
    ["4. Jam sesi opsional via session_time (contoh: 10:30, 10.30, 1030)."],
    ["5. Untuk Wedding: isi session_date ATAU isi lengkap akad_date + resepsi_date."],
    ["6. Untuk Wisuda: isi session_date ATAU isi lengkap wisuda_session_1_date + wisuda_session_2_date."],
    ["7. Untuk event Wisuda, extra.universitas wajib terdaftar di referensi universitas."],
    ["8. booking_date opsional; jika kosong akan otomatis mengikuti tanggal session_date."],
    ["9. Gunakan pemisah | atau koma untuk multi-value (services/addons/freelancers)."],
    ["10. Mapping Name + ID fallback: isi nama untuk mudah dibaca, pakai ID bila ada nama ganda."],
    ["11. Kolom dynamic: extra.<key> untuk built-in extra fields, cf.<id> untuk custom fields."],
    ["12. external_import_id dibuat otomatis oleh sistem saat validate/commit."],
    ["13. Commit hanya aktif saat tidak ada error validasi (warning masih boleh)."],
    ["14. Batas maksimum 500 baris per file .xlsx."],
    ["15. Sheet Bookings berisi baris contoh, silakan ubah/hapus sebelum commit final."],
  ];
  const guideSheet = XLSX.utils.aoa_to_sheet(guideRows);
  guideSheet["!cols"] = [{ wch: 140 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, bookingsSheet, "Bookings");
  XLSX.utils.book_append_sheet(workbook, lookupsSheet, "Lookups");
  XLSX.utils.book_append_sheet(workbook, guideSheet, "Guide");

  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
}

function resolveSheetRowsFromWorkbook(buffer: ArrayBuffer) {
  try {
    const workbook = XLSX.read(buffer, { type: "array" });
    const bookingsSheet = workbook.Sheets.Bookings;
    if (!bookingsSheet) {
      return {
        rows: [] as Record<string, unknown>[],
        headerError: "Sheet 'Bookings' tidak ditemukan.",
      };
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(bookingsSheet, {
      defval: "",
      raw: false,
    });

    return { rows, headerError: null as string | null };
  } catch {
    return {
      rows: [] as Record<string, unknown>[],
      headerError: "File .xlsx tidak valid atau tidak dapat dibaca.",
    };
  }
}

function detectMissingTemplateColumns(rows: Record<string, unknown>[]): string[] {
  const firstRow = rows[0] || {};
  const keys = new Set(Object.keys(firstRow));
  return REQUIRED_TEMPLATE_COLUMNS.filter((column) => !keys.has(column));
}

function makeReportFileName(prefix: string) {
  const datePart = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `${prefix}_${datePart}.xlsx`;
}

function workbookToBase64(buffer: Buffer) {
  return buffer.toString("base64");
}

function buildExternalImportRowSignature(row: Record<string, unknown>): string {
  const entries = Object.entries(row)
    .map(([key, value]) => [key.trim(), normalizeText(value)] as const)
    .filter(([key]) => key.length > 0 && key !== IMPORT_COLUMNS.externalImportId)
    .sort(([a], [b]) => a.localeCompare(b));

  return JSON.stringify(entries);
}

function generateExternalImportId(input: {
  userId: string;
  rowNumber: number;
  row: Record<string, unknown>;
}): string {
  const signature = buildExternalImportRowSignature(input.row);
  const hash = createHash("sha256")
    .update(`${input.userId}|v2|${input.rowNumber}|${signature}`)
    .digest("hex");
  return `impv2_${hash.slice(0, 24)}`;
}

function summarizeValidationRows(rows: NormalizedImportRow[]) {
  let validRows = 0;
  let warningRows = 0;
  let errorRows = 0;

  for (const row of rows) {
    const hasError = row.issues.some((issue) => issue.level === "error");
    const hasWarning = row.issues.some((issue) => issue.level === "warning");

    if (hasError) {
      errorRows += 1;
      continue;
    }
    if (hasWarning) {
      warningRows += 1;
      continue;
    }
    validRows += 1;
  }

  return {
    totalRows: rows.length,
    validRows,
    warningRows,
    errorRows,
  };
}

function toPreviewRows(rows: NormalizedImportRow[]): ImportPreviewRow[] {
  return rows.map((row) => ({
    rowNumber: row.rowNumber,
    externalImportId: row.externalImportId,
    clientName: row.clientName,
    eventType: row.eventType,
    sessionDate: row.sessionDate,
    status: row.status,
    mainServices: row.mainServiceNames,
    addonServices: row.addonServiceNames,
    freelancers: row.freelancerNames,
    dpPaid: row.dpPaid,
    packageTotal: row.packageTotal,
    addonTotal: row.addonTotal,
    totalPrice: row.totalPrice,
    errors: row.issues.filter((issue) => issue.level === "error").map((issue) => issue.message),
    warnings: row.issues
      .filter((issue) => issue.level === "warning")
      .map((issue) => issue.message),
  }));
}

function buildValidationReportBuffer(rows: ImportPreviewRow[]): Buffer {
  const reportRows = rows.map((row) => {
    const status =
      row.errors.length > 0 ? "ERROR" : row.warnings.length > 0 ? "WARNING" : "OK";
    return {
      row_number: row.rowNumber,
      external_import_id: row.externalImportId,
      client_name: row.clientName,
      event_type: row.eventType,
      session_date: row.sessionDate || "",
      status,
      errors: row.errors.join(" | "),
      warnings: row.warnings.join(" | "),
      main_services: row.mainServices.join(" | "),
      addon_services: row.addonServices.join(" | "),
      freelancers: row.freelancers.join(" | "),
      dp_paid: row.dpPaid,
      total_price: row.totalPrice,
    };
  });

  const sheet = XLSX.utils.json_to_sheet(reportRows);
  sheet["!cols"] = [
    { wch: 10 },
    { wch: 28 },
    { wch: 24 },
    { wch: 18 },
    { wch: 20 },
    { wch: 12 },
    { wch: 70 },
    { wch: 70 },
    { wch: 35 },
    { wch: 35 },
    { wch: 35 },
    { wch: 14 },
    { wch: 14 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Validation Report");

  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
}

function pushIssue(row: NormalizedImportRow, level: "error" | "warning", message: string) {
  row.issues.push({ level, message });
}

function normalizeCell(row: Record<string, unknown>, key: string) {
  return normalizeText(row[key]);
}

function resolveServicesFromRow(input: {
  idsCell: string;
  namesCell: string;
  row: NormalizedImportRow;
  eventType: string;
  services: ImportServiceRow[];
  label: string;
}) {
  const ids = normalizeCsvLikeValues(input.idsCell);
  const names = normalizeCsvLikeValues(input.namesCell);
  const selected: ImportServiceRow[] = [];
  const seen = new Set<string>();

  const servicesById = new Map(input.services.map((service) => [service.id, service]));
  const nameMap = new Map<string, ImportServiceRow[]>();
  for (const service of input.services) {
    const key = service.name.trim().toLowerCase();
    if (!nameMap.has(key)) nameMap.set(key, []);
    nameMap.get(key)?.push(service);
  }

  for (const id of ids) {
    const service = servicesById.get(id);
    if (!service) {
      pushIssue(input.row, "error", `${input.label}: service ID '${id}' tidak ditemukan.`);
      continue;
    }
    if (!isServiceAvailableForEvent(service, input.eventType)) {
      pushIssue(
        input.row,
        "error",
        `${input.label}: service '${service.name}' tidak aktif untuk event '${input.eventType}'.`,
      );
      continue;
    }
    if (!seen.has(service.id)) {
      seen.add(service.id);
      selected.push(service);
    }
  }

  for (const name of names) {
    const candidates = nameMap.get(name.trim().toLowerCase()) || [];
    if (candidates.length === 0) {
      pushIssue(input.row, "error", `${input.label}: service '${name}' tidak ditemukan.`);
      continue;
    }
    if (candidates.length > 1) {
      pushIssue(
        input.row,
        "error",
        `${input.label}: nama service '${name}' ambigu. Gunakan kolom ID.`,
      );
      continue;
    }

    const service = candidates[0];
    if (!isServiceAvailableForEvent(service, input.eventType)) {
      pushIssue(
        input.row,
        "error",
        `${input.label}: service '${service.name}' tidak aktif untuk event '${input.eventType}'.`,
      );
      continue;
    }

    if (!seen.has(service.id)) {
      seen.add(service.id);
      selected.push(service);
    }
  }

  return selected;
}

function resolveFreelancersFromRow(input: {
  idsCell: string;
  namesCell: string;
  row: NormalizedImportRow;
  freelancers: { id: string; name: string }[];
}) {
  const ids = normalizeCsvLikeValues(input.idsCell);
  const names = normalizeCsvLikeValues(input.namesCell);
  const selected: { id: string; name: string }[] = [];
  const seen = new Set<string>();

  const byId = new Map(input.freelancers.map((item) => [item.id, item]));
  const byName = new Map<string, { id: string; name: string }[]>();

  for (const freelancer of input.freelancers) {
    const key = freelancer.name.trim().toLowerCase();
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)?.push(freelancer);
  }

  for (const id of ids) {
    const freelancer = byId.get(id);
    if (!freelancer) {
      pushIssue(input.row, "error", `Freelance: ID '${id}' tidak ditemukan.`);
      continue;
    }
    if (!seen.has(freelancer.id)) {
      seen.add(freelancer.id);
      selected.push(freelancer);
    }
  }

  for (const name of names) {
    const candidates = byName.get(name.trim().toLowerCase()) || [];
    if (candidates.length === 0) {
      pushIssue(input.row, "error", `Freelance: '${name}' tidak ditemukan.`);
      continue;
    }
    if (candidates.length > 1) {
      pushIssue(
        input.row,
        "error",
        `Freelance: nama '${name}' ambigu. Gunakan kolom freelance_ids.`,
      );
      continue;
    }
    const freelancer = candidates[0];
    if (!seen.has(freelancer.id)) {
      seen.add(freelancer.id);
      selected.push(freelancer);
    }
  }

  if (selected.length > 5) {
    pushIssue(input.row, "error", "Maksimal 5 freelance per booking.");
  }

  return selected.slice(0, 5);
}

function buildEmptyNormalizedRow(rowNumber: number): NormalizedImportRow {
  return {
    rowNumber,
    rawExternalImportId: "",
    externalImportId: "",
    clientName: "",
    clientWhatsapp: null,
    instagram: null,
    eventType: "",
    status: "",
    sessionDate: null,
    bookingDate: null,
    mainServiceIds: [],
    addonServiceIds: [],
    freelancerIds: [],
    mainServiceNames: [],
    addonServiceNames: [],
    freelancerNames: [],
    dpPaid: 0,
    packageTotal: 0,
    addonTotal: 0,
    totalPrice: 0,
    accommodationFee: 0,
    discountAmount: 0,
    hasAccommodationFeeInput: false,
    hasDiscountAmountInput: false,
    location: null,
    locationDetail: null,
    notes: null,
    adminNotes: null,
    builtInExtraFields: {},
    customFieldSnapshots: [],
    issues: [],
  };
}

function validateCustomFieldsForRow(input: {
  row: Record<string, unknown>;
  normalized: NormalizedImportRow;
  customFieldDefs: ImportCustomFieldDefinition[];
}) {
  for (const field of input.customFieldDefs) {
    const key = `cf.${field.id}`;
    const value = normalizeCell(input.row, key);

    if (field.required && !value) {
      pushIssue(input.normalized, "error", `Custom field '${field.label}' wajib diisi.`);
      continue;
    }
    if (!value) continue;

    if (field.type === "number") {
      const parsed = normalizeMoneyNumber(value);
      if (parsed === null) {
        pushIssue(input.normalized, "error", `Custom field '${field.label}' harus angka.`);
        continue;
      }
    }

    if ((field.type === "select" || field.type === "checkbox") && field.options.length > 0) {
      if (!field.options.includes(value)) {
        pushIssue(
          input.normalized,
          "error",
          `Custom field '${field.label}' harus salah satu dari: ${field.options.join(", ")}.`,
        );
        continue;
      }
    }

    input.normalized.customFieldSnapshots.push({
      id: field.id,
      label: field.label,
      type: field.type,
      value,
      sectionId: field.sectionId,
      sectionTitle: field.sectionTitle,
    });
  }
}

function applyExtraFieldsValidation(input: {
  row: Record<string, unknown>;
  normalized: NormalizedImportRow;
  eventType: string;
}) {
  const defs = EVENT_EXTRA_FIELDS[input.eventType] || [];
  for (const field of defs) {
    const key = `extra.${field.key}`;
    const value = normalizeCell(input.row, key);

    if (field.required && !value) {
      pushIssue(
        input.normalized,
        "error",
        `Extra field '${field.label}' wajib diisi untuk event ${input.eventType}.`,
      );
      continue;
    }

    if (!value) continue;

    if (field.isNumeric) {
      const parsed = normalizeMoneyNumber(value);
      if (parsed === null) {
        pushIssue(
          input.normalized,
          "error",
          `Extra field '${field.label}' harus berupa angka.`,
        );
        continue;
      }
      input.normalized.builtInExtraFields[field.key] = String(parsed);
      continue;
    }

    input.normalized.builtInExtraFields[field.key] = value;
  }
}

function validateOneRow(input: {
  row: Record<string, unknown>;
  rowNumber: number;
  context: ImportContext;
}): NormalizedImportRow {
  const normalized = buildEmptyNormalizedRow(input.rowNumber);

  normalized.rawExternalImportId = normalizeCell(input.row, IMPORT_COLUMNS.externalImportId);
  normalized.externalImportId = generateExternalImportId({
    userId: input.context.userId,
    rowNumber: input.rowNumber,
    row: input.row,
  });

  normalized.clientName = normalizeCell(input.row, IMPORT_COLUMNS.clientName);
  if (!normalized.clientName) {
    pushIssue(normalized, "error", "client_name wajib diisi.");
  }
  const rawClientWhatsapp = normalizeText(input.row[IMPORT_COLUMNS.clientWhatsapp]);
  if (rawClientWhatsapp) {
    const normalizedWhatsapp = normalizeWhatsappValue(rawClientWhatsapp);
    if (!normalizedWhatsapp) {
      pushIssue(normalized, "error", "client_whatsapp tidak valid.");
    } else {
      normalized.clientWhatsapp = normalizedWhatsapp;
    }
  } else {
    normalized.clientWhatsapp = null;
  }
  normalized.instagram = normalizeNullableText(input.row[IMPORT_COLUMNS.instagram]);

  const resolvedEventType = normalizeEventTypeInput(
    input.row[IMPORT_COLUMNS.eventType],
    input.context.eventTypeOptions,
  );
  if (!resolvedEventType) {
    pushIssue(
      normalized,
      "error",
      `event_type tidak valid. Pilihan: ${input.context.eventTypeOptions.join(", ")}.`,
    );
  } else {
    normalized.eventType = resolvedEventType;
  }

  const normalizedStatus = normalizeStatusInput(
    input.row[IMPORT_COLUMNS.status],
    input.context.statusOptions,
  );
  if (!normalizeText(input.row[IMPORT_COLUMNS.status])) {
    normalized.status = input.context.initialStatus;
    pushIssue(
      normalized,
      "warning",
      `status kosong, default ke '${input.context.initialStatus}'.`,
    );
  } else if (!normalizedStatus) {
    pushIssue(
      normalized,
      "error",
      `status tidak valid. Pilihan: ${input.context.statusOptions.join(", ")}.`,
    );
    normalized.status = input.context.initialStatus;
  } else {
    normalized.status = normalizedStatus;
  }

  const dp = parseNonNegativeMoney(
    input.row[IMPORT_COLUMNS.dpPaid],
    "dp_paid",
    normalized.issues,
    { required: true },
  );
  normalized.dpPaid = dp.value;

  const accommodation = parseNonNegativeMoney(
    input.row[IMPORT_COLUMNS.accommodationFee],
    "accommodation_fee",
    normalized.issues,
  );
  normalized.accommodationFee = accommodation.value;
  normalized.hasAccommodationFeeInput = accommodation.hasInput;

  const discount = parseNonNegativeMoney(
    input.row[IMPORT_COLUMNS.discountAmount],
    "discount_amount",
    normalized.issues,
  );
  normalized.discountAmount = discount.value;
  normalized.hasDiscountAmountInput = discount.hasInput;

  normalized.location = normalizeNullableText(input.row[IMPORT_COLUMNS.location]);
  normalized.locationDetail = normalizeNullableText(input.row[IMPORT_COLUMNS.locationDetail]);
  normalized.notes = normalizeNullableText(input.row[IMPORT_COLUMNS.notes]);
  normalized.adminNotes = normalizeNullableText(input.row[IMPORT_COLUMNS.adminNotes]);

  if (normalized.eventType) {
    applyExtraFieldsValidation({
      row: input.row,
      normalized,
      eventType: normalized.eventType,
    });
    if (normalizeEventTypeName(normalized.eventType) === UNIVERSITY_EVENT_TYPE) {
      const universityValue = normalizeCell(
        input.row,
        `extra.${UNIVERSITY_EXTRA_FIELD_KEY}`,
      );
      if (!universityValue) {
        pushIssue(
          normalized,
          "error",
          "Extra field 'Universitas' wajib diisi untuk event Wisuda.",
        );
      } else {
        normalized.builtInExtraFields[UNIVERSITY_EXTRA_FIELD_KEY] =
          cleanUniversityName(universityValue);
      }
    }
  }

  const sessionRaw = normalizeText(input.row[IMPORT_COLUMNS.sessionDate]);
  const sessionTimeRaw = normalizeText(input.row[IMPORT_COLUMNS.sessionTime]);
  const akadRaw = normalizeText(input.row[IMPORT_COLUMNS.akadDate]);
  const resepsiRaw = normalizeText(input.row[IMPORT_COLUMNS.resepsiDate]);
  const wisudaSession1Raw = normalizeText(
    input.row[IMPORT_COLUMNS.wisudaSession1Date],
  );
  const wisudaSession2Raw = normalizeText(
    input.row[IMPORT_COLUMNS.wisudaSession2Date],
  );

  const sessionDate = sessionRaw
    ? normalizeSessionDateInput(input.row[IMPORT_COLUMNS.sessionDate])
    : null;
  const combinedSessionDate = combineSessionDateAndTime({
    sessionDate,
    sessionTimeRaw: input.row[IMPORT_COLUMNS.sessionTime],
  });
  const akadDate = akadRaw
    ? normalizeSessionDateInput(input.row[IMPORT_COLUMNS.akadDate])
    : null;
  const resepsiDate = resepsiRaw
    ? normalizeSessionDateInput(input.row[IMPORT_COLUMNS.resepsiDate])
    : null;
  const wisudaSession1Date = wisudaSession1Raw
    ? normalizeSessionDateInput(input.row[IMPORT_COLUMNS.wisudaSession1Date])
    : null;
  const wisudaSession2Date = wisudaSession2Raw
    ? normalizeSessionDateInput(input.row[IMPORT_COLUMNS.wisudaSession2Date])
    : null;

  if (sessionRaw && !sessionDate) {
    pushIssue(normalized, "error", "session_date tidak valid.");
  }
  if (sessionTimeRaw && combinedSessionDate.invalidTime) {
    pushIssue(normalized, "error", "session_time tidak valid.");
  }
  if (akadRaw && !akadDate) {
    pushIssue(normalized, "error", "akad_date tidak valid.");
  }
  if (resepsiRaw && !resepsiDate) {
    pushIssue(normalized, "error", "resepsi_date tidak valid.");
  }
  if (wisudaSession1Raw && !wisudaSession1Date) {
    pushIssue(normalized, "error", "wisuda_session_1_date tidak valid.");
  }
  if (wisudaSession2Raw && !wisudaSession2Date) {
    pushIssue(normalized, "error", "wisuda_session_2_date tidak valid.");
  }

  if (normalized.eventType.toLowerCase() === "wedding") {
    if (wisudaSession1Raw || wisudaSession2Raw) {
      pushIssue(
        normalized,
        "warning",
        "wisuda_session_1_date/wisuda_session_2_date diabaikan karena event_type bukan Wisuda.",
      );
    }

    if ((akadRaw && !resepsiRaw) || (!akadRaw && resepsiRaw)) {
      pushIssue(normalized, "error", "Untuk Wedding, akad_date dan resepsi_date harus diisi lengkap.");
    }

    if (akadDate && resepsiDate) {
      normalized.sessionDate = akadDate < resepsiDate ? akadDate : resepsiDate;
      normalized.builtInExtraFields.tanggal_akad = akadDate;
      normalized.builtInExtraFields.tanggal_resepsi = resepsiDate;
    } else if (combinedSessionDate.value) {
      normalized.sessionDate = combinedSessionDate.value;
    } else {
      pushIssue(
        normalized,
        "error",
        "Untuk Wedding, isi session_date atau akad_date + resepsi_date.",
      );
    }
  } else if (normalized.eventType.toLowerCase() === "wisuda") {
    if (akadRaw || resepsiRaw) {
      pushIssue(
        normalized,
        "warning",
        "akad_date/resepsi_date diabaikan karena event_type bukan Wedding.",
      );
    }

    if (
      (wisudaSession1Raw && !wisudaSession2Raw) ||
      (!wisudaSession1Raw && wisudaSession2Raw)
    ) {
      pushIssue(
        normalized,
        "error",
        "Untuk Wisuda, wisuda_session_1_date dan wisuda_session_2_date harus diisi lengkap.",
      );
    }

    if (wisudaSession1Date && wisudaSession2Date) {
      normalized.sessionDate =
        wisudaSession1Date < wisudaSession2Date
          ? wisudaSession1Date
          : wisudaSession2Date;
      normalized.builtInExtraFields.tanggal_wisuda_1 = wisudaSession1Date;
      normalized.builtInExtraFields.tanggal_wisuda_2 = wisudaSession2Date;
    } else if (combinedSessionDate.value) {
      normalized.sessionDate = combinedSessionDate.value;
    } else {
      pushIssue(
        normalized,
        "error",
        "Untuk Wisuda, isi session_date atau wisuda_session_1_date + wisuda_session_2_date.",
      );
    }
  } else {
    if (akadRaw || resepsiRaw) {
      pushIssue(
        normalized,
        "warning",
        "akad_date/resepsi_date diabaikan karena event_type bukan Wedding.",
      );
    }
    if (wisudaSession1Raw || wisudaSession2Raw) {
      pushIssue(
        normalized,
        "warning",
        "wisuda_session_1_date/wisuda_session_2_date diabaikan karena event_type bukan Wisuda.",
      );
    }
    normalized.sessionDate = combinedSessionDate.value;
    if (!normalized.sessionDate) {
      pushIssue(normalized, "error", "session_date wajib diisi.");
    }
  }

  const bookingDateRaw = normalizeText(input.row[IMPORT_COLUMNS.bookingDate]);
  if (bookingDateRaw) {
    const bookingDate = normalizeBookingDateInput(input.row[IMPORT_COLUMNS.bookingDate]);
    if (!bookingDate) {
      pushIssue(
        normalized,
        "error",
        "booking_date tidak valid. Gunakan format YYYY-MM-DD, DD/MM/YYYY, atau DD-MM-YYYY.",
      );
    } else {
      normalized.bookingDate = bookingDate;
    }
  } else if (normalized.sessionDate) {
    normalized.bookingDate = normalized.sessionDate.slice(0, 10);
    pushIssue(
      normalized,
      "warning",
      `booking_date kosong, default ke '${normalized.bookingDate}'.`,
    );
  }

  if (normalized.eventType) {
    const mainServices = resolveServicesFromRow({
      idsCell: normalizeCell(input.row, IMPORT_COLUMNS.mainServiceIds),
      namesCell: normalizeCell(input.row, IMPORT_COLUMNS.mainServices),
      row: normalized,
      eventType: normalized.eventType,
      services: input.context.mainServices,
      label: "main_services",
    });

    if (mainServices.length === 0) {
      pushIssue(
        normalized,
        "error",
        "Isi minimal satu paket utama di main_services atau main_service_ids.",
      );
    }

    const addonServices = resolveServicesFromRow({
      idsCell: normalizeCell(input.row, IMPORT_COLUMNS.addonServiceIds),
      namesCell: normalizeCell(input.row, IMPORT_COLUMNS.addonServices),
      row: normalized,
      eventType: normalized.eventType,
      services: input.context.addonServices,
      label: "addon_services",
    });

    const freelancers = resolveFreelancersFromRow({
      idsCell: normalizeCell(input.row, IMPORT_COLUMNS.freelanceIds),
      namesCell: normalizeCell(input.row, IMPORT_COLUMNS.freelancers),
      row: normalized,
      freelancers: input.context.freelancers,
    });

    normalized.mainServiceIds = mainServices.map((item) => item.id);
    normalized.mainServiceNames = mainServices.map((item) => item.name);
    normalized.addonServiceIds = addonServices.map((item) => item.id);
    normalized.addonServiceNames = addonServices.map((item) => item.name);
    normalized.freelancerIds = freelancers.map((item) => item.id);
    normalized.freelancerNames = freelancers.map((item) => item.name);

    const packageTotal = mainServices.reduce((sum, service) => sum + (service.price || 0), 0);
    const addonTotal = addonServices.reduce((sum, service) => sum + (service.price || 0), 0);
    normalized.packageTotal = packageTotal;
    normalized.addonTotal = addonTotal;
    normalized.totalPrice = computeSpecialOfferTotal({
      packageTotal,
      addonTotal,
      accommodationFee: normalized.accommodationFee,
      discountAmount: normalized.discountAmount,
    });

    validateCustomFieldsForRow({
      row: input.row,
      normalized,
      customFieldDefs:
        input.context.customFieldsByEventType[normalized.eventType] ||
        input.context.customFieldsByEventType.Umum ||
        [],
    });
  }

  return normalized;
}

function isBlankInputRow(row: Record<string, unknown>) {
  return Object.values(row).every((value) => normalizeText(value).length === 0);
}

function attachDuplicateExternalIdErrors(rows: NormalizedImportRow[]) {
  const index = new Map<string, number[]>();

  for (const row of rows) {
    if (!row.externalImportId) continue;
    if (!index.has(row.externalImportId)) {
      index.set(row.externalImportId, []);
    }
    index.get(row.externalImportId)?.push(row.rowNumber);
  }

  for (const row of rows) {
    if (!row.externalImportId) continue;
    const occurrences = index.get(row.externalImportId) || [];
    if (occurrences.length > 1) {
      pushIssue(
        row,
        "error",
        `external_import_id '${row.externalImportId}' duplikat dalam file (baris ${occurrences.join(", ")}).`,
      );
    }
  }
}

async function attachExistingExternalIdErrors(
  supabase: SupabaseClient,
  userId: string,
  rows: NormalizedImportRow[],
) {
  const ids = Array.from(
    new Set(rows.map((row) => row.externalImportId).filter(Boolean)),
  );
  if (ids.length === 0) return;

  const { data, error } = await supabase
    .from("bookings")
    .select("external_import_id")
    .eq("user_id", userId)
    .in("external_import_id", ids);

  if (error) {
    for (const row of rows) {
      pushIssue(
        row,
        "error",
        `Gagal validasi idempotency di database: ${error.message}`,
      );
    }
    return;
  }

  const existing = new Set(
    ((data || []) as Array<{ external_import_id?: string | null }>)
      .map((item) => normalizeText(item.external_import_id))
      .filter(Boolean),
  );

  for (const row of rows) {
    if (!row.externalImportId) continue;
    if (existing.has(row.externalImportId)) {
      pushIssue(
        row,
        "error",
        `external_import_id '${row.externalImportId}' sudah ada di database.`,
      );
    }
  }
}

function buildUniversityLookupCandidates(submittedValue: string) {
  const cleaned = cleanUniversityName(submittedValue);
  const normalizedNameCandidates = new Set<string>();
  const normalizedAbbreviationCandidates = new Set<string>();
  if (!cleaned) {
    return {
      cleaned,
      normalizedNameCandidates,
      normalizedAbbreviationCandidates,
    };
  }

  normalizedNameCandidates.add(normalizeUniversityName(cleaned));

  const displayMatch = cleaned.match(/^(.*)\(([^()]+)\)\s*$/);
  if (displayMatch) {
    const parsedName = cleanUniversityName(displayMatch[1] || "");
    const parsedAbbreviation = normalizeUniversityAbbreviation(
      displayMatch[2] || "",
    );

    if (parsedName) {
      normalizedNameCandidates.add(normalizeUniversityName(parsedName));
    }
    if (parsedAbbreviation) {
      normalizedAbbreviationCandidates.add(parsedAbbreviation);
    }
  }

  const normalizedAbbreviation = normalizeUniversityAbbreviation(cleaned);
  if (normalizedAbbreviation && normalizedAbbreviation.length <= 24) {
    normalizedAbbreviationCandidates.add(normalizedAbbreviation);
  }

  return {
    cleaned,
    normalizedNameCandidates,
    normalizedAbbreviationCandidates,
  };
}

function getUniversityLookupRows(
  map: Map<string, UniversityReferenceLookupRow>,
  token: string,
) {
  const value = token.trim();
  if (!value) return [] as UniversityReferenceLookupRow[];
  const row = map.get(value);
  return row ? [row] : [];
}

async function attachUniversityReferenceValidation(
  supabase: SupabaseClient,
  rows: NormalizedImportRow[],
) {
  const wisudaRows = rows.filter(
    (row) => normalizeEventTypeName(row.eventType) === UNIVERSITY_EVENT_TYPE,
  );
  if (wisudaRows.length === 0) return;

  const rowCandidates = new Map<
    number,
    ReturnType<typeof buildUniversityLookupCandidates>
  >();
  const normalizedNames = new Set<string>();
  const normalizedAbbreviations = new Set<string>();

  for (const row of wisudaRows) {
    const submitted = normalizeText(row.builtInExtraFields[UNIVERSITY_EXTRA_FIELD_KEY]);
    if (!submitted) continue;

    const candidates = buildUniversityLookupCandidates(submitted);
    rowCandidates.set(row.rowNumber, candidates);

    candidates.normalizedNameCandidates.forEach((item) => {
      if (item) normalizedNames.add(item);
    });
    candidates.normalizedAbbreviationCandidates.forEach((item) => {
      if (item) normalizedAbbreviations.add(item);
    });
  }

  const byNormalizedName = new Map<string, UniversityReferenceLookupRow>();
  const byNormalizedAbbreviation = new Map<string, UniversityReferenceLookupRow>();

  try {
    if (normalizedNames.size > 0) {
      const { data, error } = await supabase
        .from("university_references")
        .select("id, name, abbreviation, normalized_name, normalized_abbreviation")
        .in("normalized_name", Array.from(normalizedNames));

      if (error) throw error;
      for (const row of (data || []) as UniversityReferenceLookupRow[]) {
        if (!row.normalized_name) continue;
        byNormalizedName.set(row.normalized_name, row);
      }
    }

    if (normalizedAbbreviations.size > 0) {
      const { data, error } = await supabase
        .from("university_references")
        .select("id, name, abbreviation, normalized_name, normalized_abbreviation")
        .in("normalized_abbreviation", Array.from(normalizedAbbreviations));

      if (error) throw error;
      for (const row of (data || []) as UniversityReferenceLookupRow[]) {
        if (!row.normalized_abbreviation) continue;
        if (!byNormalizedAbbreviation.has(row.normalized_abbreviation)) {
          byNormalizedAbbreviation.set(row.normalized_abbreviation, row);
        } else {
          // Mark ambiguous abbreviation by clearing the deterministic mapping.
          byNormalizedAbbreviation.delete(row.normalized_abbreviation);
        }
      }
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Gagal memvalidasi referensi universitas.";
    for (const row of wisudaRows) {
      pushIssue(row, "error", `Gagal memvalidasi universitas: ${message}`);
    }
    return;
  }

  for (const row of wisudaRows) {
    const submitted = normalizeText(row.builtInExtraFields[UNIVERSITY_EXTRA_FIELD_KEY]);
    if (!submitted) continue;

    const candidates = rowCandidates.get(row.rowNumber);
    if (!candidates) {
      pushIssue(
        row,
        "error",
        `Universitas '${submitted}' tidak ditemukan pada referensi.`,
      );
      continue;
    }

    const matchedRows = new Map<string, UniversityReferenceLookupRow>();
    candidates.normalizedNameCandidates.forEach((token) => {
      getUniversityLookupRows(byNormalizedName, token).forEach((item) => {
        matchedRows.set(item.id, item);
      });
    });
    candidates.normalizedAbbreviationCandidates.forEach((token) => {
      getUniversityLookupRows(byNormalizedAbbreviation, token).forEach((item) => {
        matchedRows.set(item.id, item);
      });
    });

    const resolvedRows = Array.from(matchedRows.values()).filter((item) => {
      if (
        normalizeUniversityAbbreviation(submitted) &&
        item.normalized_abbreviation === normalizeUniversityAbbreviation(submitted)
      ) {
        return true;
      }
      return matchesUniversityDisplayValue({
        submittedValue: submitted,
        name: item.name,
        abbreviation: item.abbreviation,
      });
    });

    if (resolvedRows.length === 0) {
      pushIssue(
        row,
        "error",
        `Universitas '${submitted}' tidak ditemukan pada referensi.`,
      );
      continue;
    }

    if (resolvedRows.length > 1) {
      pushIssue(
        row,
        "error",
        `Universitas '${submitted}' ambigu. Gunakan nama/display universitas yang lebih spesifik.`,
      );
      continue;
    }

    const chosen = resolvedRows[0];
    row.builtInExtraFields[UNIVERSITY_EXTRA_FIELD_KEY] = buildUniversityDisplayName(
      chosen.name,
      chosen.abbreviation,
    );
    row.builtInExtraFields[UNIVERSITY_REFERENCE_EXTRA_KEY] = chosen.id;
  }
}

function makeHeaderErrorValidationResult(
  message: string,
  fileNamePrefix: string,
): ImportValidationResult {
  const previewRows: ImportPreviewRow[] = [
    {
      rowNumber: 0,
      externalImportId: "",
      clientName: "",
      eventType: "",
      sessionDate: null,
      status: "",
      mainServices: [],
      addonServices: [],
      freelancers: [],
      dpPaid: 0,
      packageTotal: 0,
      addonTotal: 0,
      totalPrice: 0,
      errors: [message],
      warnings: [],
    },
  ];

  const reportBuffer = buildValidationReportBuffer(previewRows);
  return {
    summary: {
      totalRows: 0,
      validRows: 0,
      warningRows: 0,
      errorRows: 1,
    },
    canCommit: false,
    hasErrors: true,
    previewRows,
    normalizedRows: [],
    report: {
      fileName: makeReportFileName(fileNamePrefix),
      base64: workbookToBase64(reportBuffer),
    },
  };
}

export async function validateImportWorkbook(
  supabase: SupabaseClient,
  userId: string,
  context: ImportContext,
  arrayBuffer: ArrayBuffer,
  options: ValidationOptions,
): Promise<ImportValidationResult> {
  const { rows, headerError } = resolveSheetRowsFromWorkbook(arrayBuffer);
  if (headerError) {
    return makeHeaderErrorValidationResult(headerError, options.fileNamePrefix);
  }

  const nonBlankRows = rows.filter((row) => !isBlankInputRow(row));
  if (nonBlankRows.length === 0) {
    return makeHeaderErrorValidationResult(
      "Sheet Bookings kosong. Isi minimal 1 baris data.",
      options.fileNamePrefix,
    );
  }

  if (nonBlankRows.length > IMPORT_MAX_ROWS) {
    return makeHeaderErrorValidationResult(
      `Jumlah baris melebihi batas ${IMPORT_MAX_ROWS}.`,
      options.fileNamePrefix,
    );
  }

  const missingColumns = detectMissingTemplateColumns(nonBlankRows);
  if (missingColumns.length > 0) {
    return makeHeaderErrorValidationResult(
      `Template tidak valid. Kolom wajib tidak ditemukan: ${missingColumns.join(", ")}.`,
      options.fileNamePrefix,
    );
  }

  const normalizedRows = nonBlankRows.map((row, index) =>
    validateOneRow({
      row,
      rowNumber: index + 2,
      context,
    }),
  );

  attachDuplicateExternalIdErrors(normalizedRows);
  await attachExistingExternalIdErrors(supabase, userId, normalizedRows);
  await attachUniversityReferenceValidation(supabase, normalizedRows);

  const summary = summarizeValidationRows(normalizedRows);
  const previewRows = toPreviewRows(normalizedRows);
  const reportBuffer = buildValidationReportBuffer(previewRows);

  return {
    summary,
    canCommit: summary.errorRows === 0,
    hasErrors: summary.errorRows > 0,
    previewRows,
    normalizedRows,
    report: {
      fileName: makeReportFileName(options.fileNamePrefix),
      base64: workbookToBase64(reportBuffer),
    },
  };
}

export function toImportReportFile(
  fileName: string,
  rows: ImportPreviewRow[],
): ImportReportFile {
  const buffer = buildValidationReportBuffer(rows);
  return {
    fileName,
    base64: workbookToBase64(buffer),
  };
}

export function getImportTemplateHeaders(context: ImportContext) {
  return getTemplateHeaders(context);
}

export function buildImportedBookingExtraFields(row: NormalizedImportRow) {
  const extra: Record<string, unknown> = {
    ...row.builtInExtraFields,
  };

  if (row.addonServiceIds.length > 0) {
    extra.addon_ids = row.addonServiceIds;
    extra.addon_names = row.addonServiceNames;
  }

  if (row.customFieldSnapshots.length > 0) {
    extra.custom_fields = row.customFieldSnapshots;
  }

  const specialOffer = buildEditableSpecialOfferSnapshot({
    existingSnapshot: null,
    selectedEventType: row.eventType,
    selectedPackageServiceIds: row.mainServiceIds,
    selectedAddonServiceIds: row.addonServiceIds,
    packageTotal: row.packageTotal,
    addonTotal: row.addonTotal,
    accommodationFee: row.accommodationFee,
    discountAmount: row.discountAmount,
    includeWhenZero: row.hasAccommodationFeeInput || row.hasDiscountAmountInput,
  });

  return mergeSpecialOfferSnapshotIntoExtraFields(extra, specialOffer);
}

export function resolveImportedLocation(row: NormalizedImportRow): {
  location: string | null;
  locationLat: number | null;
  locationLng: number | null;
} {
  const weddingAkad = normalizeNullableText(row.builtInExtraFields.tempat_akad);
  const weddingResepsi = normalizeNullableText(row.builtInExtraFields.tempat_resepsi);
  const wisudaSession1 = normalizeNullableText(
    row.builtInExtraFields.tempat_wisuda_1,
  );
  const wisudaSession2 = normalizeNullableText(
    row.builtInExtraFields.tempat_wisuda_2,
  );
  const fallback = normalizeNullableText(row.location);

  return {
    location:
      weddingAkad ||
      weddingResepsi ||
      wisudaSession1 ||
      wisudaSession2 ||
      fallback,
    locationLat: null,
    locationLng: null,
  };
}

export function buildCommitReportFile(
  fileName: string,
  previewRows: ImportPreviewRow[],
  commitRows: ImportCommitRowResult[],
): ImportReportFile {
  const commitMap = new Map(
    commitRows.map((item) => [item.rowNumber, item]),
  );
  const rows = previewRows.map((preview) => {
    const commit = commitMap.get(preview.rowNumber);
    return {
      row_number: preview.rowNumber,
      external_import_id: preview.externalImportId,
      client_name: preview.clientName,
      event_type: preview.eventType,
      validation_status:
        preview.errors.length > 0
          ? "ERROR"
          : preview.warnings.length > 0
            ? "WARNING"
            : "OK",
      commit_status: commit?.status || "failed",
      booking_code: commit?.bookingCode || "",
      booking_id: commit?.bookingId || "",
      errors: [...preview.errors, commit?.error || ""].filter(Boolean).join(" | "),
      warnings: preview.warnings.join(" | "),
      main_services: preview.mainServices.join(" | "),
      addon_services: preview.addonServices.join(" | "),
      freelancers: preview.freelancers.join(" | "),
      dp_paid: preview.dpPaid,
      total_price: preview.totalPrice,
    };
  });

  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet["!cols"] = [
    { wch: 10 },
    { wch: 28 },
    { wch: 24 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
    { wch: 20 },
    { wch: 38 },
    { wch: 72 },
    { wch: 50 },
    { wch: 35 },
    { wch: 35 },
    { wch: 35 },
    { wch: 14 },
    { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Commit Report");
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;

  return {
    fileName,
    base64: workbookToBase64(buffer),
  };
}
