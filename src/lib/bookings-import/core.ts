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
  eventType: "event_type",
  mainServices: "main_services",
  mainServiceIds: "main_service_ids",
  sessionDate: "session_date",
  akadDate: "akad_date",
  resepsiDate: "resepsi_date",
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

type ValidationOptions = {
  fileNamePrefix: string;
};

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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

function normalizeSessionDateInput(value: unknown): string | null {
  const raw = normalizeText(value);
  if (!raw) return null;

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

  return null;
}

function normalizeBookingDateInput(value: unknown): string | null {
  const raw = normalizeText(value);
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return parseSessionDateParts(`${raw}T00:00`) ? raw : null;
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
    IMPORT_COLUMNS.eventType,
    IMPORT_COLUMNS.mainServices,
    IMPORT_COLUMNS.mainServiceIds,
    IMPORT_COLUMNS.sessionDate,
    IMPORT_COLUMNS.akadDate,
    IMPORT_COLUMNS.resepsiDate,
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
    [IMPORT_COLUMNS.eventType]: nonWeddingEventType,
    [IMPORT_COLUMNS.mainServices]: nonWeddingMainService?.name || "",
    [IMPORT_COLUMNS.mainServiceIds]: "",
    [IMPORT_COLUMNS.sessionDate]: "2026-07-15T10:00",
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
      [IMPORT_COLUMNS.eventType]: weddingEventType,
      [IMPORT_COLUMNS.mainServices]: weddingMainService?.name || "",
      [IMPORT_COLUMNS.mainServiceIds]: "",
      [IMPORT_COLUMNS.sessionDate]: "",
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
    ["2. Date format: YYYY-MM-DD atau YYYY-MM-DDTHH:mm (timezone Asia/Jakarta)."],
    ["3. Untuk Wedding: isi session_date ATAU isi lengkap akad_date + resepsi_date."],
    ["4. Gunakan pemisah | atau koma untuk multi-value (services/addons/freelancers)."],
    ["5. Mapping Name + ID fallback: isi nama untuk mudah dibaca, pakai ID bila ada nama ganda."],
    ["6. Kolom dynamic: extra.<key> untuk built-in extra fields, cf.<id> untuk custom fields."],
    ["7. external_import_id dibuat otomatis oleh sistem saat validate/commit."],
    ["8. Commit hanya aktif saat tidak ada error validasi (warning masih boleh)."],
    ["9. Batas maksimum 500 baris per file .xlsx."],
    ["10. Sheet Bookings berisi baris contoh, silakan ubah/hapus sebelum commit final."],
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

  const bookingDateRaw = normalizeText(input.row[IMPORT_COLUMNS.bookingDate]);
  if (bookingDateRaw) {
    const bookingDate = normalizeBookingDateInput(bookingDateRaw);
    if (!bookingDate) {
      pushIssue(normalized, "error", "booking_date harus format YYYY-MM-DD.");
    } else {
      normalized.bookingDate = bookingDate;
    }
  }

  if (normalized.eventType) {
    applyExtraFieldsValidation({
      row: input.row,
      normalized,
      eventType: normalized.eventType,
    });
  }

  const sessionRaw = normalizeText(input.row[IMPORT_COLUMNS.sessionDate]);
  const akadRaw = normalizeText(input.row[IMPORT_COLUMNS.akadDate]);
  const resepsiRaw = normalizeText(input.row[IMPORT_COLUMNS.resepsiDate]);

  const sessionDate = sessionRaw ? normalizeSessionDateInput(sessionRaw) : null;
  const akadDate = akadRaw ? normalizeSessionDateInput(akadRaw) : null;
  const resepsiDate = resepsiRaw ? normalizeSessionDateInput(resepsiRaw) : null;

  if (sessionRaw && !sessionDate) {
    pushIssue(normalized, "error", "session_date tidak valid.");
  }
  if (akadRaw && !akadDate) {
    pushIssue(normalized, "error", "akad_date tidak valid.");
  }
  if (resepsiRaw && !resepsiDate) {
    pushIssue(normalized, "error", "resepsi_date tidak valid.");
  }

  if (normalized.eventType.toLowerCase() === "wedding") {
    if ((akadRaw && !resepsiRaw) || (!akadRaw && resepsiRaw)) {
      pushIssue(normalized, "error", "Untuk Wedding, akad_date dan resepsi_date harus diisi lengkap.");
    }

    if (akadDate && resepsiDate) {
      normalized.sessionDate = akadDate < resepsiDate ? akadDate : resepsiDate;
      normalized.builtInExtraFields.tanggal_akad = akadDate;
      normalized.builtInExtraFields.tanggal_resepsi = resepsiDate;
    } else if (sessionDate) {
      normalized.sessionDate = sessionDate;
    } else {
      pushIssue(
        normalized,
        "error",
        "Untuk Wedding, isi session_date atau akad_date + resepsi_date.",
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
    normalized.sessionDate = sessionDate;
    if (!normalized.sessionDate) {
      pushIssue(normalized, "error", "session_date wajib diisi.");
    }
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
  const fallback = normalizeNullableText(row.location);

  return {
    location: weddingAkad || weddingResepsi || fallback,
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
