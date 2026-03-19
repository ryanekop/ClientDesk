import { syncBookingToFastpik } from "@/lib/fastpik-integration/server";
import {
  resolveFastpikProjectInfoFromExtraFields,
  type FastpikProjectInfoSnapshot,
} from "@/lib/fastpik-project-info";

export const FASTPIK_LIVE_THROTTLE_MS = 5 * 60 * 1000;

export type FastpikLiveSource = "live" | "fallback";

export type FastpikLiveBookingFields = {
  id: string;
  user_id: string;
  fastpik_project_id: string | null;
  fastpik_project_link: string | null;
  fastpik_project_edit_link: string | null;
  fastpik_sync_status: string | null;
  fastpik_last_synced_at: string | null;
  extra_fields: Record<string, unknown> | null;
};

type FastpikSingleResponse = { data: unknown };

type FastpikLiveSupabaseClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        single: () => PromiseLike<FastpikSingleResponse>;
      };
    };
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export type FastpikLiveSyncResult = {
  booking: FastpikLiveBookingFields;
  source: FastpikLiveSource;
  syncedAt: string | null;
  attempted: boolean;
  throttled: boolean;
  message: string | null;
  fastpikProjectInfo: FastpikProjectInfoSnapshot | null;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    const message = (error as { message: string }).message.trim();
    if (message) return message;
  }
  return fallback;
}

function parseIsoToTimestamp(value: string | null | undefined) {
  if (!value || typeof value !== "string") return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function isFastpikSyncThrottled(
  lastSyncedAt: string | null | undefined,
  options: { now?: number; throttleMs?: number } = {},
) {
  const now = Number.isFinite(options.now) ? Number(options.now) : Date.now();
  const throttleMs = Math.max(
    0,
    Number.isFinite(options.throttleMs)
      ? Number(options.throttleMs)
      : FASTPIK_LIVE_THROTTLE_MS,
  );
  if (throttleMs <= 0) return false;
  const lastSyncTimestamp = parseIsoToTimestamp(lastSyncedAt);
  if (lastSyncTimestamp === null) return false;
  return now - lastSyncTimestamp < throttleMs;
}

function pickFastpikBookingFields(
  value: Partial<FastpikLiveBookingFields> | null | undefined,
  fallback: FastpikLiveBookingFields,
): FastpikLiveBookingFields {
  return {
    ...fallback,
    fastpik_project_id:
      value?.fastpik_project_id !== undefined
        ? value.fastpik_project_id || null
        : fallback.fastpik_project_id,
    fastpik_project_link:
      value?.fastpik_project_link !== undefined
        ? value.fastpik_project_link || null
        : fallback.fastpik_project_link,
    fastpik_project_edit_link:
      value?.fastpik_project_edit_link !== undefined
        ? value.fastpik_project_edit_link || null
        : fallback.fastpik_project_edit_link,
    fastpik_sync_status:
      value?.fastpik_sync_status !== undefined
        ? value.fastpik_sync_status || null
        : fallback.fastpik_sync_status,
    fastpik_last_synced_at:
      value?.fastpik_last_synced_at !== undefined
        ? value.fastpik_last_synced_at || null
        : fallback.fastpik_last_synced_at,
    extra_fields:
      value?.extra_fields !== undefined
        ? value.extra_fields || null
        : fallback.extra_fields,
  };
}

async function fetchLatestFastpikBookingFields(
  supabase: unknown,
  booking: FastpikLiveBookingFields,
) {
  const supabaseClient = supabase as FastpikLiveSupabaseClient;
  const { data } = await supabaseClient
    .from("bookings")
    .select(
      "id, user_id, fastpik_project_id, fastpik_project_link, fastpik_project_edit_link, fastpik_sync_status, fastpik_last_synced_at, extra_fields",
    )
    .eq("id", booking.id)
    .single();

  if (!isRecord(data)) return booking;
  return pickFastpikBookingFields(
    data as Partial<FastpikLiveBookingFields>,
    booking,
  );
}

export async function hydrateFastpikLiveData(params: {
  supabase: unknown;
  booking: FastpikLiveBookingFields;
  locale?: string;
  throttleMs?: number;
}): Promise<FastpikLiveSyncResult> {
  const { supabase, booking, locale, throttleMs } = params;

  const throttled = isFastpikSyncThrottled(booking.fastpik_last_synced_at, {
    throttleMs,
  });
  if (throttled) {
    const fastpikProjectInfo = resolveFastpikProjectInfoFromExtraFields(
      booking.extra_fields,
    );
    const normalizedSyncStatus =
      typeof booking.fastpik_sync_status === "string"
        ? booking.fastpik_sync_status.trim().toLowerCase()
        : "";
    const throttledSource: FastpikLiveSource =
      normalizedSyncStatus === "failed" ? "fallback" : "live";
    return {
      booking,
      source: throttledSource,
      syncedAt:
        booking.fastpik_last_synced_at ||
        fastpikProjectInfo?.synced_at ||
        null,
      attempted: false,
      throttled: true,
      message:
        throttledSource === "fallback"
          ? "recent_sync_cache_fallback"
          : "recent_sync_cache",
      fastpikProjectInfo,
    };
  }

  try {
    const syncResult = await syncBookingToFastpik({
      supabase,
      userId: booking.user_id,
      bookingId: booking.id,
      locale,
    });
    const latestBooking = await fetchLatestFastpikBookingFields(supabase, booking);
    const fastpikProjectInfo =
      resolveFastpikProjectInfoFromExtraFields(latestBooking.extra_fields) ||
      syncResult.fastpikProjectInfo ||
      null;
    const source: FastpikLiveSource = syncResult.success ? "live" : "fallback";

    return {
      booking: latestBooking,
      source,
      syncedAt:
        latestBooking.fastpik_last_synced_at ||
        fastpikProjectInfo?.synced_at ||
        null,
      attempted: true,
      throttled: false,
      message: syncResult.message || null,
      fastpikProjectInfo,
    };
  } catch (error: unknown) {
    const latestBooking = await fetchLatestFastpikBookingFields(supabase, booking);
    const fastpikProjectInfo = resolveFastpikProjectInfoFromExtraFields(
      latestBooking.extra_fields,
    );

    return {
      booking: latestBooking,
      source: "fallback",
      syncedAt:
        latestBooking.fastpik_last_synced_at ||
        fastpikProjectInfo?.synced_at ||
        null,
      attempted: true,
      throttled: false,
      message: getErrorMessage(error, "fastpik_live_sync_failed"),
      fastpikProjectInfo,
    };
  }
}
