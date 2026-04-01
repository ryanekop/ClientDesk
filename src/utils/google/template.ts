import {
    buildExtraFieldTemplateVars,
    getEventExtraFieldTemplateTokens,
    buildMultiSessionTemplateVars,
} from "@/utils/form-extra-fields";
import { parseSessionDateParts } from "@/utils/format-date";

export const GOOGLE_TEMPLATE_TIMEZONE = "Asia/Jakarta";

export const GOOGLE_EVENT_TYPES = [
    "Umum",
    "Wedding",
    "Akad",
    "Resepsi",
    "Lamaran",
    "Prewedding",
    "Wisuda",
    "Maternity",
    "Newborn",
    "Family",
    "Komersil",
    "Custom/Lainnya",
] as const;

export type GoogleEventType = (typeof GOOGLE_EVENT_TYPES)[number];
export type TemplateFormatMap = Record<string, string>;
export type GoogleCalendarTemplateMode = "normal" | "split";
export type GoogleCalendarDateTime = {
    dateTime: string;
    timeZone: string;
};

type DateParts = {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
};

const MONTHS_ID = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
];

const DAYS_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export const DEFAULT_CALENDAR_EVENT_FORMAT = "📸 {{client_name}} — {{service_name}}";
export const DEFAULT_CALENDAR_EVENT_DESCRIPTION =
    "Klien: {{client_name}}\nWhatsApp: {{client_whatsapp}}\nBooking: {{booking_code}}\nDetail Booking: {{booking_detail_link}}\nPaket: {{service_name}}\nTanggal: {{session_date}}\nJam: {{session_time}} - {{end_time}}\nTipe Acara: {{event_type}}\nLokasi: {{location}}\nMaps: {{location_maps_url}}\nDetail Lokasi: {{detail_location}}\nCatatan: {{notes}}";
export const CALENDAR_TEMPLATE_SPLIT_MODE_SUFFIX = "__split";
const SPLIT_CAPABLE_CALENDAR_TEMPLATE_EVENTS = new Set(["Wedding", "Wisuda"]);
const DEFAULT_CALENDAR_SPLIT_EVENT_DESCRIPTIONS: Record<
    "Wedding" | "Wisuda",
    string
> = {
    Wedding:
        "Klien: {{client_name}}\nWhatsApp: {{client_whatsapp}}\nBooking: {{booking_code}}\nDetail Booking: {{booking_detail_link}}\nPaket: {{service_name}}\nJadwal:\n- Akad: {{akad_date}} {{akad_time}} di {{akad_location}}\n- Resepsi: {{resepsi_date}} {{resepsi_time}} di {{resepsi_location}}\nTipe Acara: {{event_type}}\nLokasi Utama: {{location}}\nMaps: {{location_maps_url}}\nDetail Lokasi: {{detail_location}}\nCatatan: {{notes}}",
    Wisuda:
        "Klien: {{client_name}}\nWhatsApp: {{client_whatsapp}}\nBooking: {{booking_code}}\nDetail Booking: {{booking_detail_link}}\nPaket: {{service_name}}\nJadwal:\n- Sesi 1: {{wisuda_session_1_date}} {{wisuda_session_1_time_range}} di {{wisuda_session_1_location}}\n- Sesi 2: {{wisuda_session_2_date}} {{wisuda_session_2_time_range}} di {{wisuda_session_2_location}}\nTipe Acara: {{event_type}}\nLokasi Utama: {{location}}\nMaps: {{location_maps_url}}\nDetail Lokasi: {{detail_location}}\nCatatan: {{notes}}",
};
export const DEFAULT_DRIVE_FOLDER_FORMAT = "{client_name}";
export const DEFAULT_DRIVE_FOLDER_STRUCTURE = [DEFAULT_DRIVE_FOLDER_FORMAT];

export const CALENDAR_TEMPLATE_VARIABLES = [
    "{{client_name}}",
    "{{client_whatsapp}}",
    "{{instagram}}",
    "{{instagram_link}}",
    "{{freelance}}",
    "{{service_name}}",
    "{{event_type}}",
    "{{booking_code}}",
    "{{booking_detail_link}}",
    "{{studio_name}}",
    "{{session_date}}",
    "{{session_time}}",
    "{{end_time}}",
    "{{day_name}}",
    "{{location}}",
    "{{location_maps_url}}",
    "{{detail_location}}",
    "{{notes}}",
] as const;

const WEDDING_SPLIT_CALENDAR_TEMPLATE_VARIABLES = [
    "{{akad_location}}",
    "{{akad_date}}",
    "{{akad_time}}",
    "{{resepsi_location}}",
    "{{resepsi_date}}",
    "{{resepsi_time}}",
    "{{resepsi_maps_url}}",
] as const;

const WISUDA_SPLIT_CALENDAR_TEMPLATE_VARIABLES = [
    "{{wisuda_session_1_location}}",
    "{{wisuda_session_1_date}}",
    "{{wisuda_session_1_time}}",
    "{{wisuda_session_1_maps_url}}",
    "{{wisuda_session_2_location}}",
    "{{wisuda_session_2_date}}",
    "{{wisuda_session_2_time}}",
    "{{wisuda_session_2_maps_url}}",
] as const;

export const DRIVE_TEMPLATE_VARIABLES = [
    "{client_name}",
    "{booking_code}",
    "{event_type}",
    "{studio_name}",
    "{session_date}",
    "{session_time}",
    "{day_name}",
    "{year}",
    "{month_number}",
    "{month_name}",
] as const;

export type DriveFolderStructureMap = Record<string, string[]>;

const LEGACY_CUSTOM_EVENT_TYPE = "Lainnya";
const CANONICAL_CUSTOM_EVENT_TYPE = "Custom/Lainnya";

function normalizeTemplateEventTypeName(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const normalized = value.trim();
    if (!normalized) return null;
    if (normalized === LEGACY_CUSTOM_EVENT_TYPE) {
        return CANONICAL_CUSTOM_EVENT_TYPE;
    }
    return normalized;
}

function getEventTypeLookupKeys(eventType: string | null | undefined): string[] {
    const normalized = normalizeTemplateEventTypeName(eventType);
    if (!normalized) return [];
    if (normalized === CANONICAL_CUSTOM_EVENT_TYPE) {
        return [CANONICAL_CUSTOM_EVENT_TYPE, LEGACY_CUSTOM_EVENT_TYPE];
    }
    return [normalized];
}

export function normalizeGoogleCalendarTemplateMode(
    value: unknown,
): GoogleCalendarTemplateMode {
    return value === "split" ? "split" : "normal";
}

export function isSplitCapableCalendarTemplateEvent(
    eventType: string | null | undefined,
) {
    const normalized = normalizeTemplateEventTypeName(eventType);
    return normalized
        ? SPLIT_CAPABLE_CALENDAR_TEMPLATE_EVENTS.has(normalized)
        : false;
}

export function buildCalendarDescriptionMapKey(
    eventType: string | null | undefined,
    mode: GoogleCalendarTemplateMode = "normal",
) {
    const normalizedEventType = normalizeTemplateEventTypeName(eventType) || "Umum";
    const normalizedMode = normalizeGoogleCalendarTemplateMode(mode);
    if (normalizedMode === "split") {
        return `${normalizedEventType}${CALENDAR_TEMPLATE_SPLIT_MODE_SUFFIX}`;
    }
    return normalizedEventType;
}

export function getDefaultCalendarEventDescriptionByMode({
    eventType,
    mode = "normal",
}: {
    eventType?: string | null;
    mode?: GoogleCalendarTemplateMode;
} = {}) {
    const normalizedEventType = normalizeTemplateEventTypeName(eventType);
    const normalizedMode = normalizeGoogleCalendarTemplateMode(mode);
    if (
        normalizedMode === "split" &&
        normalizedEventType &&
        isSplitCapableCalendarTemplateEvent(normalizedEventType)
    ) {
        return DEFAULT_CALENDAR_SPLIT_EVENT_DESCRIPTIONS[
            normalizedEventType as "Wedding" | "Wisuda"
        ];
    }
    return DEFAULT_CALENDAR_EVENT_DESCRIPTION;
}

export function normalizeCalendarEventDescriptionMap(
    value: unknown,
    fallback: string = DEFAULT_CALENDAR_EVENT_DESCRIPTION,
): TemplateFormatMap {
    const normalized = normalizeTemplateFormatMap(value, fallback);
    (["Wedding", "Wisuda"] as const).forEach((eventType) => {
        const splitKey = buildCalendarDescriptionMapKey(eventType, "split");
        if (!Object.prototype.hasOwnProperty.call(normalized, splitKey)) {
            normalized[splitKey] =
                DEFAULT_CALENDAR_SPLIT_EVENT_DESCRIPTIONS[eventType];
        }
    });
    return normalized;
}

export function resolveCalendarDescriptionTemplateByMode({
    mapValue,
    eventType,
    mode,
    fallback = DEFAULT_CALENDAR_EVENT_DESCRIPTION,
}: {
    mapValue: unknown;
    eventType: string | null | undefined;
    mode?: GoogleCalendarTemplateMode;
    fallback?: string;
}): string {
    const normalized = normalizeTemplateFormatMap(mapValue, fallback);
    const normalizedMode = normalizeGoogleCalendarTemplateMode(mode);
    const eventKeys = getEventTypeLookupKeys(eventType);
    const normalizedEventType = normalizeTemplateEventTypeName(eventType);

    const findTemplate = (key: string) => {
        const value = normalized[key];
        return typeof value === "string" && value.trim() ? value.trim() : null;
    };
    const findByMode = (
        keys: string[],
        targetMode: GoogleCalendarTemplateMode,
    ) => {
        for (const key of keys) {
            const entry = findTemplate(buildCalendarDescriptionMapKey(key, targetMode));
            if (entry) return entry;
        }
        return null;
    };

    if (normalizedMode === "split") {
        const eventSplit = findByMode(eventKeys, "split");
        if (eventSplit) return eventSplit;
    }

    const eventNormal = findByMode(eventKeys, "normal");
    if (eventNormal) return eventNormal;

    if (normalizedMode === "split") {
        const generalSplit = findTemplate(
            buildCalendarDescriptionMapKey("Umum", "split"),
        );
        if (generalSplit) return generalSplit;
    }

    const generalNormal = findTemplate("Umum");
    if (generalNormal) return generalNormal;

    if (
        normalizedMode === "split" &&
        normalizedEventType &&
        isSplitCapableCalendarTemplateEvent(normalizedEventType)
    ) {
        return DEFAULT_CALENDAR_SPLIT_EVENT_DESCRIPTIONS[
            normalizedEventType as "Wedding" | "Wisuda"
        ];
    }

    return fallback;
}

export function normalizeTemplateFormatMap(value: unknown, fallback: string): TemplateFormatMap {
    const normalized: TemplateFormatMap = Object.fromEntries(
        GOOGLE_EVENT_TYPES.map((eventType) => [eventType, eventType === "Umum" ? fallback : ""]),
    );

    if (value && typeof value === "object" && !Array.isArray(value)) {
        for (const [key, mapValue] of Object.entries(value)) {
            const normalizedKey = normalizeTemplateEventTypeName(key);
            if (typeof mapValue === "string") {
                if (!normalizedKey) continue;
                if (!(normalizedKey in normalized) || key === normalizedKey) {
                    normalized[normalizedKey] = mapValue;
                }
            }
        }
    }

    if (!normalized.Umum?.trim()) {
        normalized.Umum = fallback;
    }

    return normalized;
}

export function resolveTemplateByEventType(
    mapValue: unknown,
    eventType: string | null | undefined,
    fallback: string,
): string {
    const normalized = normalizeTemplateFormatMap(mapValue, fallback);
    const eventSpecific = getEventTypeLookupKeys(eventType)
        .map((key) => normalized[key]?.trim())
        .find(Boolean);
    return eventSpecific || normalized.Umum?.trim() || fallback;
}

function getCalendarSplitTemplateVariables(
    eventType: string | null | undefined,
    mode: GoogleCalendarTemplateMode = "normal",
) {
    if (normalizeGoogleCalendarTemplateMode(mode) !== "split") return [];

    const normalizedEventType = normalizeTemplateEventTypeName(eventType);
    if (normalizedEventType === "Wedding") {
        return [...WEDDING_SPLIT_CALENDAR_TEMPLATE_VARIABLES];
    }
    if (normalizedEventType === "Wisuda") {
        return [...WISUDA_SPLIT_CALENDAR_TEMPLATE_VARIABLES];
    }
    return [];
}

export function getCalendarTemplateVariables(
    eventType: string | null | undefined,
    mode: GoogleCalendarTemplateMode = "normal",
): string[] {
    return Array.from(
        new Set([
            ...CALENDAR_TEMPLATE_VARIABLES,
            ...getCalendarSplitTemplateVariables(eventType, mode),
            ...getEventExtraFieldTemplateTokens(eventType, "calendar"),
        ]),
    );
}

export function getDriveTemplateVariables(eventType: string | null | undefined): string[] {
    return Array.from(
        new Set([
            ...DRIVE_TEMPLATE_VARIABLES,
            ...getEventExtraFieldTemplateTokens(eventType, "drive"),
        ]),
    );
}

export function applyCalendarTemplate(template: string, vars: Record<string, string | null | undefined>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => vars[key] || `{{${key}}}`);
}

export function buildCalendarTemplateVars(
    baseVars: Record<string, string | null | undefined>,
    extraFields?: unknown,
    options: {
        locale?: "id" | "en";
        sessionDurationMinutesByKey?: Record<string, number | undefined>;
    } = {},
): Record<string, string | null | undefined> {
    return {
        ...baseVars,
        ...buildMultiSessionTemplateVars(extraFields, {
            locale: options.locale || "id",
            sessionDurationMinutesByKey: options.sessionDurationMinutesByKey,
        }),
        ...buildExtraFieldTemplateVars(extraFields),
        ...buildGoogleCustomFieldTemplateVars(extraFields),
    };
}

export function buildDriveTemplateVars(
    baseVars: Record<string, string | null | undefined>,
    extraFields?: unknown,
): Record<string, string | null | undefined> {
    return {
        ...baseVars,
        ...buildExtraFieldTemplateVars(extraFields),
        ...buildGoogleCustomFieldTemplateVars(extraFields),
    };
}

export function applyDriveTemplate(template: string, vars: Record<string, string | null | undefined>): string {
    const result = template.replace(/\{(\w+)\}/g, (_match, key: string) => vars[key] || `{${key}}`).trim();
    return result || vars.client_name || "Client";
}

export function normalizeDriveFolderStructureMap(
    value: unknown,
    fallback: string[] = DEFAULT_DRIVE_FOLDER_STRUCTURE,
): DriveFolderStructureMap {
    const normalized: DriveFolderStructureMap = Object.fromEntries(
        GOOGLE_EVENT_TYPES.map((eventType) => [eventType, eventType === "Umum" ? [...fallback] : []]),
    );

    if (value && typeof value === "object" && !Array.isArray(value)) {
        for (const [key, mapValue] of Object.entries(value)) {
            const normalizedKey = normalizeTemplateEventTypeName(key);
            if (!normalizedKey) continue;
            if (Array.isArray(mapValue)) {
                const nextValue = mapValue.filter(
                    (item): item is string => typeof item === "string" && item.trim().length > 0,
                );
                if (!(normalizedKey in normalized) || key === normalizedKey) {
                    normalized[normalizedKey] = nextValue;
                }
            } else if (typeof mapValue === "string" && mapValue.trim()) {
                if (!(normalizedKey in normalized) || key === normalizedKey) {
                    normalized[normalizedKey] = [mapValue.trim()];
                }
            }
        }
    }

    if (!normalized.Umum || normalized.Umum.length === 0) {
        normalized.Umum = [...fallback];
    }

    return normalized;
}

export function resolveDriveFolderStructureByEventType(
    structureMap: unknown,
    eventType: string | null | undefined,
    fallback: string[] = DEFAULT_DRIVE_FOLDER_STRUCTURE,
): string[] {
    const normalized = normalizeDriveFolderStructureMap(structureMap, fallback);
    const eventSpecific = getEventTypeLookupKeys(eventType)
        .map((key) => normalized[key] || [])
        .find((segments) => segments.length > 0);
    return eventSpecific || normalized.Umum || [...fallback];
}

export function buildCalendarRangeFromStoredSession(sessionDate: string, durationMinutes: number) {
    const startParts = getStoredSessionParts(sessionDate);
    const endParts = addMinutes(startParts, durationMinutes);
    return buildRange(startParts, endParts);
}

export function buildCalendarRangeFromLocalInput(sessionDate: string, durationMinutes: number) {
    const startParts = getLocalInputParts(sessionDate);
    const endParts = addMinutes(startParts, durationMinutes);
    return buildRange(startParts, endParts);
}

export function buildCalendarRangeFromInstants(start: Date, end: Date) {
    const startParts = getTimeZoneParts(start);
    const endParts = getTimeZoneParts(end);
    return buildRange(startParts, endParts);
}

function buildRange(startParts: DateParts, endParts: DateParts) {
    return {
        start: {
            dateTime: formatDateTime(startParts),
            timeZone: GOOGLE_TEMPLATE_TIMEZONE,
        } satisfies GoogleCalendarDateTime,
        end: {
            dateTime: formatDateTime(endParts),
            timeZone: GOOGLE_TEMPLATE_TIMEZONE,
        } satisfies GoogleCalendarDateTime,
        templateVars: {
            session_date: formatDateLabel(startParts),
            session_time: formatTimeLabel(startParts),
            end_time: formatTimeLabel(endParts),
            day_name: getDayName(startParts),
            year: String(startParts.year),
            month_number: String(startParts.month).padStart(2, "0"),
            month_name: MONTHS_ID[startParts.month - 1] || "",
        },
    };
}

function getStoredSessionParts(sessionDate: string): DateParts {
    const parts = parseSessionDateParts(sessionDate);
    if (!parts) {
        throw new Error("Invalid stored session date");
    }

    return {
        year: parts.year,
        month: parts.month,
        day: parts.day,
        hour: parts.hours,
        minute: parts.minutes,
        second: parts.seconds,
    };
}

function getLocalInputParts(sessionDate: string): DateParts {
    const match = sessionDate.match(
        /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
    );

    if (match) {
        return {
            year: Number(match[1]),
            month: Number(match[2]),
            day: Number(match[3]),
            hour: Number(match[4]),
            minute: Number(match[5]),
            second: Number(match[6] || "0"),
        };
    }

    const fallbackDate = new Date(sessionDate);
    if (Number.isNaN(fallbackDate.getTime())) {
        throw new Error("Invalid local input session date");
    }

    return getTimeZoneParts(fallbackDate);
}

function getTimeZoneParts(date: Date): DateParts {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: GOOGLE_TEMPLATE_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const getPart = (type: Intl.DateTimeFormatPartTypes) =>
        Number(parts.find((part) => part.type === type)?.value || "0");

    return {
        year: getPart("year"),
        month: getPart("month"),
        day: getPart("day"),
        hour: getPart("hour"),
        minute: getPart("minute"),
        second: getPart("second"),
    };
}

function addMinutes(parts: DateParts, minutes: number): DateParts {
    const date = new Date(
        Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second),
    );
    date.setUTCMinutes(date.getUTCMinutes() + minutes);

    return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
        hour: date.getUTCHours(),
        minute: date.getUTCMinutes(),
        second: date.getUTCSeconds(),
    };
}

function formatDateTime(parts: DateParts): string {
    return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}

function formatDateLabel(parts: DateParts): string {
    return `${parts.day} ${MONTHS_ID[parts.month - 1]} ${parts.year}`;
}

function formatTimeLabel(parts: DateParts): string {
    return `${pad(parts.hour)}.${pad(parts.minute)}`;
}

function getDayName(parts: DateParts): string {
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    return DAYS_ID[date.getUTCDay()];
}

function pad(value: number): string {
    return String(value).padStart(2, "0");
}

function buildGoogleCustomFieldTemplateVars(
    raw: unknown,
): Record<string, string> {
    if (!raw || typeof raw !== "object") return {};

    const customFields = (raw as Record<string, unknown>).custom_fields;
    if (!Array.isArray(customFields)) return {};

    return Object.fromEntries(
        customFields
            .filter(
                (item): item is { id?: unknown; value?: unknown } =>
                    Boolean(item) && typeof item === "object" && !Array.isArray(item),
            )
            .map((item) => {
                const id = typeof item.id === "string" ? item.id.trim() : "";
                const value = stringifyCalendarTemplateValue(item.value);
                return [id, value] as const;
            })
            .filter(([id, value]) => id.length > 0 && value.length > 0),
    ) as Record<string, string>;
}

function stringifyCalendarTemplateValue(value: unknown): string {
    if (value == null) return "";
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    if (Array.isArray(value)) {
        return value
            .map((item) => stringifyCalendarTemplateValue(item))
            .filter(Boolean)
            .join(", ");
    }
    if (typeof value === "object") {
        return Object.values(value as Record<string, unknown>)
            .map((item) => stringifyCalendarTemplateValue(item))
            .filter(Boolean)
            .join(", ");
    }
    return "";
}
