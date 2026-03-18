/**
 * Session date formatter with wall-clock parsing.
 *
 * Important:
 * - For ISO-like strings (with or without timezone), we read date/time parts
 *   directly from the text to avoid implicit browser timezone conversion.
 * - For non-ISO inputs, we fall back to Date parsing + UTC getters.
 */

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const DAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type SessionDateParts = {
    year: number;
    month: number;
    day: number;
    hours: number;
    minutes: number;
    seconds: number;
};

const ISO_LIKE_SESSION_REGEX =
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}(?::?\d{2})?)?$/;

function isValidSessionDateParts(parts: SessionDateParts) {
    if (parts.month < 1 || parts.month > 12) return false;
    if (parts.day < 1 || parts.day > 31) return false;
    if (parts.hours < 0 || parts.hours > 23) return false;
    if (parts.minutes < 0 || parts.minutes > 59) return false;
    if (parts.seconds < 0 || parts.seconds > 59) return false;

    const normalized = new Date(
        Date.UTC(
            parts.year,
            parts.month - 1,
            parts.day,
            parts.hours,
            parts.minutes,
            parts.seconds,
        ),
    );

    return (
        normalized.getUTCFullYear() === parts.year &&
        normalized.getUTCMonth() + 1 === parts.month &&
        normalized.getUTCDate() === parts.day &&
        normalized.getUTCHours() === parts.hours &&
        normalized.getUTCMinutes() === parts.minutes &&
        normalized.getUTCSeconds() === parts.seconds
    );
}

export function parseSessionDateParts(
    dateStr: string | null | undefined,
): SessionDateParts | null {
    if (!dateStr) return null;
    const trimmed = dateStr.trim();
    if (!trimmed) return null;

    const isoMatch = trimmed.match(ISO_LIKE_SESSION_REGEX);
    if (isoMatch) {
        const parsed: SessionDateParts = {
            year: Number(isoMatch[1]),
            month: Number(isoMatch[2]),
            day: Number(isoMatch[3]),
            hours: Number(isoMatch[4] || "0"),
            minutes: Number(isoMatch[5] || "0"),
            seconds: Number(isoMatch[6] || "0"),
        };

        if (isValidSessionDateParts(parsed)) {
            return parsed;
        }
    }

    const fallback = new Date(trimmed);
    if (isNaN(fallback.getTime())) return null;

    return {
        year: fallback.getUTCFullYear(),
        month: fallback.getUTCMonth() + 1,
        day: fallback.getUTCDate(),
        hours: fallback.getUTCHours(),
        minutes: fallback.getUTCMinutes(),
        seconds: fallback.getUTCSeconds(),
    };
}

/**
 * Format a date string without implicit timezone conversion.
 * ISO-like inputs are rendered using their textual wall-clock components.
 *
 * @param dateStr - ISO date string from Supabase (e.g. "2026-03-15T02:00:00+00:00")
 * @param options.locale - "id" or "en"
 * @param options.withTime - include time (HH:mm)
 * @param options.withDay - include day name (Senin, etc)
 * @param options.dateOnly - only show date (no time, no day)
 */
export function formatSessionDate(
    dateStr: string | null | undefined,
    options: {
        locale?: "id" | "en";
        withTime?: boolean;
        withDay?: boolean;
        dateOnly?: boolean;
    } = {}
): string {
    const { locale = "id", withTime = true, withDay = true, dateOnly = false } = options;
    const parts = parseSessionDateParts(dateStr);
    if (!parts) return "-";

    const day = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
    const date = parts.day;
    const month = parts.month - 1;
    const year = parts.year;
    const hours = String(parts.hours).padStart(2, "0");
    const minutes = String(parts.minutes).padStart(2, "0");

    const isId = locale === "id";

    if (dateOnly) {
        return `${date} ${isId ? BULAN[month] : MONTHS_EN[month]} ${year}`;
    }

    let result = "";
    if (withDay) {
        result += `${isId ? HARI[day] : DAYS_EN[day]}, `;
    }
    result += `${date} ${isId ? BULAN[month] : MONTHS_EN[month]} ${year}`;
    if (withTime) {
        result += ` ${hours}.${minutes}`;
    }

    return result;
}

export function formatTemplateSessionDate(
    dateStr: string | null | undefined,
    options: {
        locale?: "id" | "en";
        withDay?: boolean;
    } = {},
): string {
    return formatSessionDate(dateStr, {
        locale: options.locale,
        withDay: options.withDay ?? false,
        withTime: false,
        dateOnly: true,
    });
}

export function formatSessionTime(
    dateStr: string | null | undefined,
    options: { separator?: "." | ":" } = {},
): string {
    const parts = parseSessionDateParts(dateStr);
    if (!parts) return "-";

    const separator = options.separator || ".";
    const hours = String(parts.hours).padStart(2, "0");
    const minutes = String(parts.minutes).padStart(2, "0");

    return `${hours}${separator}${minutes}`;
}

/**
 * Get a Date object for calendar/comparison purposes using wall-clock parts.
 */
export function getSessionDateUTC(dateStr: string): Date {
    const parts = parseSessionDateParts(dateStr);
    if (!parts) {
        return new Date(dateStr);
    }
    return new Date(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hours,
        parts.minutes,
        parts.seconds,
    );
}
