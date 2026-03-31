import { invalidatePublicCachesForBooking } from "@/lib/public-cache-invalidation";
import {
  GOOGLE_INVALID_GRANT_CODE,
  getGoogleInvalidGrantMessage,
  isGoogleInvalidGrantError,
} from "@/lib/google-oauth-error";

type SupabaseErrorLike = {
  message?: string;
  details?: string;
  hint?: string;
} | null;

type SupabaseUpdateQuery = PromiseLike<{ error: SupabaseErrorLike }> & {
  eq: (column: string, value: string) => SupabaseUpdateQuery;
};

type SupabaseLike = {
  from: (table: string) => {
    update: (patch: Record<string, unknown>) => SupabaseUpdateQuery;
  };
};

export type GoogleCalendarSyncStatus =
  | "pending"
  | "success"
  | "failed"
  | "skipped";

export const NO_SCHEDULE_SYNC_MESSAGE = "Booking belum punya jadwal sesi.";
export const GOOGLE_SCOPE_MISMATCH_CODE = "GOOGLE_SCOPE_MISMATCH";
export { GOOGLE_INVALID_GRANT_CODE };

const GOOGLE_SCOPE_MISMATCH_PATTERNS = [
  "insufficient authentication scopes",
  "request had insufficient authentication scopes",
  "insufficientpermissions",
];

function getGoogleCalendarRawErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  return "";
}

export function isGoogleScopeMismatchMessage(message: string) {
  const normalized = message.trim().toLowerCase();
  if (!normalized) return false;
  return GOOGLE_SCOPE_MISMATCH_PATTERNS.some((pattern) =>
    normalized.includes(pattern),
  );
}

export function isGoogleScopeMismatchError(error: unknown) {
  return isGoogleScopeMismatchMessage(getGoogleCalendarRawErrorMessage(error));
}

export function getGoogleCalendarSyncErrorCode(error: unknown) {
  if (isGoogleInvalidGrantError(error)) {
    return GOOGLE_INVALID_GRANT_CODE;
  }
  if (isGoogleScopeMismatchError(error)) {
    return GOOGLE_SCOPE_MISMATCH_CODE;
  }
  return null;
}

function extractMissingColumnFromSupabaseError(error: SupabaseErrorLike) {
  const messages = [error?.message, error?.details, error?.hint].filter(
    (value): value is string => Boolean(value),
  );

  for (const message of messages) {
    const schemaCacheMatch = message.match(
      /Could not find the '([^']+)' column/i,
    );
    if (schemaCacheMatch?.[1]) {
      return schemaCacheMatch[1];
    }

    const postgresMatch = message.match(
      /column\s+["']?(?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+)["']?\s+does not exist/i,
    );
    if (postgresMatch?.[1]) {
      return postgresMatch[1];
    }
  }

  return null;
}

export function getGoogleCalendarSyncErrorMessage(
  error: unknown,
  fallback = "Terjadi kesalahan saat sinkronisasi kalender.",
) {
  const rawMessage = getGoogleCalendarRawErrorMessage(error);
  if (isGoogleInvalidGrantError(error)) {
    return getGoogleInvalidGrantMessage("calendar");
  }
  if (isGoogleScopeMismatchMessage(rawMessage)) {
    return "Izin Google Calendar sudah tidak sesuai. Silakan hubungkan ulang akun Google Calendar di Pengaturan.";
  }
  if (rawMessage) {
    return rawMessage;
  }
  return fallback;
}

export function isNoScheduleSyncError(error: unknown) {
  const message = getGoogleCalendarSyncErrorMessage(error, "");
  return message === NO_SCHEDULE_SYNC_MESSAGE;
}

type UpdateBookingCalendarSyncStateArgs = {
  supabase: SupabaseLike;
  bookingId: string;
  userId?: string;
  status: GoogleCalendarSyncStatus;
  errorMessage?: string | null;
  eventId?: string | null;
  eventIds?: Record<string, string> | null;
};

export async function updateBookingCalendarSyncState({
  supabase,
  bookingId,
  userId,
  status,
  errorMessage = null,
  eventId,
  eventIds,
}: UpdateBookingCalendarSyncStateArgs) {
  const patch: Record<string, unknown> = {
    google_calendar_sync_status: status,
    google_calendar_sync_error: errorMessage,
    google_calendar_last_synced_at: new Date().toISOString(),
  };

  if (status === "success") {
    patch.google_calendar_sync_error = null;
  }

  if (typeof eventId !== "undefined") {
    patch.google_calendar_event_id = eventId;
  }
  if (typeof eventIds !== "undefined") {
    patch.google_calendar_event_ids = eventIds;
  }

  const droppedColumns: string[] = [];

  while (Object.keys(patch).length > 0) {
    let query = supabase.from("bookings").update(patch).eq("id", bookingId);
    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { error } = await query;
    if (!error) {
      if (userId) {
        invalidatePublicCachesForBooking({ userId });
      }
      return { ok: true, droppedColumns };
    }

    const missingColumn = extractMissingColumnFromSupabaseError(error);
    if (missingColumn && Object.prototype.hasOwnProperty.call(patch, missingColumn)) {
      delete patch[missingColumn];
      droppedColumns.push(missingColumn);
      continue;
    }

    return { ok: false, error, droppedColumns };
  }

  return { ok: true, droppedColumns };
}
