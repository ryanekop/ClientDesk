import type { createClient } from "@/utils/supabase/server";

export const GOOGLE_CALENDAR_PROFILE_COLUMNS = [
  "google_access_token",
  "google_refresh_token",
  "studio_name",
  "calendar_event_format",
  "calendar_event_format_map",
  "calendar_event_description",
  "calendar_event_description_map",
] as const;

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

type SupabaseErrorLike = {
  message?: string;
  details?: string;
  hint?: string;
} | null;

export type GoogleCalendarProfile = {
  google_access_token?: string | null;
  google_refresh_token?: string | null;
  studio_name?: string | null;
  calendar_event_format?: string | null;
  calendar_event_format_map?: Record<string, string> | null;
  calendar_event_description?: string | null;
  calendar_event_description_map?: Record<string, string> | null;
};

type FetchGoogleCalendarProfileResult = {
  data: GoogleCalendarProfile | null;
  error: SupabaseErrorLike;
  selectedColumns: string[];
  droppedColumns: string[];
};

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

export async function fetchGoogleCalendarProfileSchemaSafe(
  supabase: ServerSupabaseClient,
  userId: string,
  columns: readonly string[] = GOOGLE_CALENDAR_PROFILE_COLUMNS,
): Promise<FetchGoogleCalendarProfileResult> {
  let selectedColumns = Array.from(
    new Set(columns.map((column) => column.trim()).filter(Boolean)),
  );
  const droppedColumns: string[] = [];
  let lastError: SupabaseErrorLike = null;

  while (selectedColumns.length > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select(selectedColumns.join(", "))
      .eq("id", userId)
      .maybeSingle();

    if (!error) {
      return {
        data: (data as GoogleCalendarProfile | null) ?? null,
        error: null,
        selectedColumns,
        droppedColumns,
      };
    }

    const missingColumn = extractMissingColumnFromSupabaseError(error);
    if (missingColumn && selectedColumns.includes(missingColumn)) {
      selectedColumns = selectedColumns.filter(
        (column) => column !== missingColumn,
      );
      droppedColumns.push(missingColumn);
      continue;
    }

    lastError = error;
    break;
  }

  if (!lastError && selectedColumns.length === 0) {
    lastError = {
      message: "No selectable profile columns remain after schema-safe retries.",
    };
  }

  return {
    data: null,
    error: lastError,
    selectedColumns,
    droppedColumns,
  };
}
