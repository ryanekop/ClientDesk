import {
    buildExtraFieldTemplateVars,
    getEventExtraFieldTemplateTokens,
    getMultiSessionTemplateTokens,
    buildMultiSessionTemplateVars,
} from "@/utils/form-extra-fields";

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
    "Lainnya",
] as const;

export type GoogleEventType = (typeof GOOGLE_EVENT_TYPES)[number];
export type TemplateFormatMap = Record<string, string>;
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
    "Klien: {{client_name}}\nWhatsApp: {{client_whatsapp}}\nBooking: {{booking_code}}\nPaket: {{service_name}}\nTanggal: {{session_date}}\nJam: {{session_time}} - {{end_time}}\nJenis Acara: {{event_type}}\nLokasi: {{location}}\nMaps: {{location_maps_url}}\nDetail Lokasi: {{detail_location}}\nCatatan: {{notes}}";
export const DEFAULT_DRIVE_FOLDER_FORMAT = "{client_name}";
export const DEFAULT_DRIVE_FOLDER_STRUCTURE = [DEFAULT_DRIVE_FOLDER_FORMAT];

export const CALENDAR_TEMPLATE_VARIABLES = [
    "{{client_name}}",
    "{{client_whatsapp}}",
    "{{service_name}}",
    "{{event_type}}",
    "{{booking_code}}",
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

export function normalizeTemplateFormatMap(value: unknown, fallback: string): TemplateFormatMap {
    const normalized: TemplateFormatMap = Object.fromEntries(
        GOOGLE_EVENT_TYPES.map((eventType) => [eventType, eventType === "Umum" ? fallback : ""]),
    );

    if (value && typeof value === "object" && !Array.isArray(value)) {
        for (const [key, mapValue] of Object.entries(value)) {
            if (typeof mapValue === "string") {
                normalized[key] = mapValue;
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
    const eventSpecific = eventType ? normalized[eventType]?.trim() : "";
    return eventSpecific || normalized.Umum?.trim() || fallback;
}

export function getCalendarTemplateVariables(eventType: string | null | undefined): string[] {
    return Array.from(
        new Set([
            ...CALENDAR_TEMPLATE_VARIABLES,
            ...getMultiSessionTemplateTokens("calendar"),
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
): Record<string, string | null | undefined> {
    return {
        ...baseVars,
        ...buildMultiSessionTemplateVars(extraFields, { locale: "id" }),
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
            if (Array.isArray(mapValue)) {
                normalized[key] = mapValue.filter(
                    (item): item is string => typeof item === "string" && item.trim().length > 0,
                );
            } else if (typeof mapValue === "string" && mapValue.trim()) {
                normalized[key] = [mapValue.trim()];
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
    const eventSpecific = eventType ? normalized[eventType] || [] : [];
    return eventSpecific.length > 0 ? eventSpecific : normalized.Umum || [...fallback];
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
    const date = new Date(sessionDate);

    if (Number.isNaN(date.getTime())) {
        throw new Error("Invalid stored session date");
    }

    return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
        hour: date.getUTCHours(),
        minute: date.getUTCMinutes(),
        second: date.getUTCSeconds(),
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
