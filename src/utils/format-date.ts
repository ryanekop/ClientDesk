/**
 * Format a session date string **without timezone conversion**.
 *
 * The problem: admin enters "2026-03-15T02:00" → Supabase stores as UTC →
 * `new Date(...)` converts UTC to local timezone on display → +7h offset in WIB.
 *
 * This function treats the stored date as-is (reads UTC fields) so it will
 * always display the exact time the admin entered.
 */

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const DAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * Format a date string without timezone conversion.
 * Uses UTC getters so it matches the exact time entered by the user.
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
    if (!dateStr) return "-";

    const { locale = "id", withTime = true, withDay = true, dateOnly = false } = options;
    const d = new Date(dateStr);

    if (isNaN(d.getTime())) return "-";

    const day = d.getUTCDay();
    const date = d.getUTCDate();
    const month = d.getUTCMonth();
    const year = d.getUTCFullYear();
    const hours = String(d.getUTCHours()).padStart(2, "0");
    const minutes = String(d.getUTCMinutes()).padStart(2, "0");

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
    if (!dateStr) return "-";

    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";

    const separator = options.separator || ".";
    const hours = String(d.getUTCHours()).padStart(2, "0");
    const minutes = String(d.getUTCMinutes()).padStart(2, "0");

    return `${hours}${separator}${minutes}`;
}

/**
 * Get a Date object representing the UTC values of a session date
 * (for calendar/comparison purposes — treats stored UTC as local).
 */
export function getSessionDateUTC(dateStr: string): Date {
    const d = new Date(dateStr);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes());
}
