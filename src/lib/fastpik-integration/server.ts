type FastpikSyncStatus = "idle" | "success" | "warning" | "failed" | "syncing";

type ProfileFastpikSettings = {
  id: string;
  fastpik_integration_enabled: boolean | null;
  fastpik_sync_mode: "manual" | "auto" | null;
  fastpik_preset_source: "clientdesk" | "fastpik" | null;
  fastpik_api_key: string | null;
  fastpik_last_sync_at: string | null;
  fastpik_last_sync_status: FastpikSyncStatus | null;
  fastpik_last_sync_message: string | null;
  fastpik_default_max_photos: number | null;
  fastpik_default_selection_days: number | null;
  fastpik_default_download_days: number | null;
  fastpik_default_detect_subfolders: boolean | null;
  fastpik_default_password: string | null;
};

type BookingFastpikSyncRow = {
  id: string;
  user_id: string;
  client_name: string;
  client_whatsapp: string | null;
  drive_folder_url: string | null;
  fastpik_project_id: string | null;
  fastpik_project_link: string | null;
  fastpik_sync_status: FastpikSyncStatus | null;
  fastpik_last_synced_at: string | null;
  fastpik_sync_message: string | null;
};

type SyncResult = {
  success: boolean;
  status: FastpikSyncStatus;
  message: string;
  bookingId?: string;
  projectId?: string | null;
  projectLink?: string | null;
};

const FASTPIK_REQUEST_TIMEOUT_MS = 15000;
const FASTPIK_RETRY_COUNT = 1;
export const FASTPIK_SYNC_CHUNK_SIZE = 50;

function resolveFastpikBaseUrl() {
  return (
    process.env.FASTPIK_API_BASE_URL ||
    process.env.FASTPIK_BASE_URL ||
    "https://fastpik.ryanekoapp.web.id"
  ).replace(/\/+$/, "");
}

function normalizeStatus(value: unknown, fallback: FastpikSyncStatus = "idle") {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (
    raw === "idle" ||
    raw === "success" ||
    raw === "warning" ||
    raw === "failed" ||
    raw === "syncing"
  ) {
    return raw;
  }
  return fallback;
}

async function patchProfileSyncLog(
  supabase: any,
  userId: string,
  payload: {
    status: FastpikSyncStatus;
    message: string;
    at?: string;
  },
) {
  await supabase
    .from("profiles")
    .update({
      fastpik_last_sync_status: payload.status,
      fastpik_last_sync_message: payload.message,
      fastpik_last_sync_at: payload.at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
}

async function patchBookingSyncState(
  supabase: any,
  bookingId: string,
  payload: {
    status: FastpikSyncStatus;
    message: string;
    projectId?: string | null;
    projectLink?: string | null;
    at?: string;
  },
) {
  await supabase
    .from("bookings")
    .update({
      fastpik_sync_status: payload.status,
      fastpik_sync_message: payload.message,
      fastpik_project_id:
        payload.projectId !== undefined ? payload.projectId : undefined,
      fastpik_project_link:
        payload.projectLink !== undefined ? payload.projectLink : undefined,
      fastpik_last_synced_at: payload.at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", bookingId);
}

async function getProfileFastpikSettings(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, fastpik_integration_enabled, fastpik_sync_mode, fastpik_preset_source, fastpik_api_key, fastpik_last_sync_at, fastpik_last_sync_status, fastpik_last_sync_message, fastpik_default_max_photos, fastpik_default_selection_days, fastpik_default_download_days, fastpik_default_detect_subfolders, fastpik_default_password",
    )
    .eq("id", userId)
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Profil integrasi Fastpik tidak ditemukan.");
  }

  return data as ProfileFastpikSettings;
}

async function getBookingForSync(supabase: any, userId: string, bookingId: string) {
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, user_id, client_name, client_whatsapp, drive_folder_url, fastpik_project_id, fastpik_project_link, fastpik_sync_status, fastpik_last_synced_at, fastpik_sync_message",
    )
    .eq("id", bookingId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Booking tidak ditemukan.");
  }

  return data as BookingFastpikSyncRow;
}

async function callFastpikUpsert(
  profile: ProfileFastpikSettings,
  booking: BookingFastpikSyncRow,
  options?: { locale?: string; syncOffsetMs?: number },
) {
  const apiKey = (profile.fastpik_api_key || "").trim();
  if (!apiKey) {
    throw new Error("API key Fastpik belum diisi.");
  }

  const payload = {
    source_app: "clientdesk",
    source_ref_id: booking.id,
    locale: options?.locale || "id",
    preset_source:
      profile.fastpik_preset_source === "clientdesk" ? "clientdesk" : "fastpik",
    client_name: booking.client_name,
    client_whatsapp: booking.client_whatsapp || "",
    gdrive_link: booking.drive_folder_url || "",
    sync_offset_ms: Math.max(0, Math.floor(options?.syncOffsetMs || 0)),
    clientdesk_defaults: {
      max_photos: profile.fastpik_default_max_photos,
      selection_days: profile.fastpik_default_selection_days,
      download_days: profile.fastpik_default_download_days,
      detect_subfolders: Boolean(profile.fastpik_default_detect_subfolders),
      default_password: profile.fastpik_default_password,
    },
  };

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= FASTPIK_RETRY_COUNT; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FASTPIK_REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(
        `${resolveFastpikBaseUrl()}/api/integrations/clientdesk/upsert`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-clientdesk-api-key": apiKey,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        },
      );

      const body = await response.json().catch(() => null);
      if (response.status >= 500 && attempt < FASTPIK_RETRY_COUNT) {
        continue;
      }
      return { response, body };
    } catch (error) {
      lastError = error;
      if (attempt >= FASTPIK_RETRY_COUNT) {
        throw error;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error("Gagal menghubungi Fastpik.");
}

async function callFastpikPing(apiKey: string) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= FASTPIK_RETRY_COUNT; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FASTPIK_REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(
        `${resolveFastpikBaseUrl()}/api/integrations/clientdesk/ping`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-clientdesk-api-key": apiKey,
          },
          signal: controller.signal,
        },
      );
      const body = await response.json().catch(() => null);
      if (response.status >= 500 && attempt < FASTPIK_RETRY_COUNT) {
        continue;
      }
      return { response, body };
    } catch (error) {
      lastError = error;
      if (attempt >= FASTPIK_RETRY_COUNT) {
        throw error;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error("Gagal menghubungi Fastpik.");
}

export async function testFastpikIntegrationConnection(
  supabase: any,
  userId: string,
) {
  const profile = await getProfileFastpikSettings(supabase, userId);
  const apiKey = (profile.fastpik_api_key || "").trim();
  if (!apiKey) {
    return {
      success: false,
      status: "failed" as FastpikSyncStatus,
      message: "API key Fastpik belum diisi.",
    };
  }

  try {
    await patchProfileSyncLog(supabase, userId, {
      status: "syncing",
      message: "Menguji koneksi ke Fastpik...",
    });

    const { response, body: payload } = await callFastpikPing(apiKey);
    if (response.ok && payload?.success) {
      await patchProfileSyncLog(supabase, userId, {
        status: "success",
        message: "Koneksi Fastpik berhasil.",
      });
      return {
        success: true,
        status: "success" as FastpikSyncStatus,
        message: "Koneksi Fastpik berhasil.",
      };
    }

    const message = payload?.error || "Koneksi Fastpik gagal.";
    await patchProfileSyncLog(supabase, userId, {
      status: "failed",
      message,
    });
    return {
      success: false,
      status: "failed" as FastpikSyncStatus,
      message,
    };
  } catch (error: any) {
    const message =
      error?.name === "AbortError"
        ? "Timeout saat menguji koneksi Fastpik."
        : error?.message || "Koneksi Fastpik gagal.";
    await patchProfileSyncLog(supabase, userId, {
      status: "failed",
      message,
    });
    return {
      success: false,
      status: "failed" as FastpikSyncStatus,
      message,
    };
  }
}

export async function syncBookingToFastpik(params: {
  supabase: any;
  userId: string;
  bookingId: string;
  locale?: string;
  syncOffsetMs?: number;
  force?: boolean;
}): Promise<SyncResult> {
  const { supabase, userId, bookingId, locale, syncOffsetMs = 0, force = false } = params;
  const profile = await getProfileFastpikSettings(supabase, userId);

  if (!profile.fastpik_integration_enabled) {
    return {
      success: false,
      status: "idle",
      bookingId,
      message: "Integrasi Fastpik belum diaktifkan.",
    };
  }

  const syncMode = profile.fastpik_sync_mode === "auto" ? "auto" : "manual";
  if (!force && syncMode === "manual") {
    return {
      success: false,
      status: "idle",
      bookingId,
      message: "Mode sync Fastpik masih manual.",
    };
  }

  const booking = await getBookingForSync(supabase, userId, bookingId);

  if (!booking.drive_folder_url || !booking.drive_folder_url.trim()) {
    const warningMessage =
      "Link Google Drive kosong. Project Fastpik dipertahankan tanpa update.";
    const syncedAt = new Date().toISOString();
    await patchBookingSyncState(supabase, booking.id, {
      status: "warning",
      message: "missing_drive_link",
      at: syncedAt,
    });
    await patchProfileSyncLog(supabase, userId, {
      status: "warning",
      message: warningMessage,
      at: syncedAt,
    });
    return {
      success: false,
      status: "warning",
      bookingId: booking.id,
      projectId: booking.fastpik_project_id,
      projectLink: booking.fastpik_project_link,
      message: warningMessage,
    };
  }

  await patchProfileSyncLog(supabase, userId, {
    status: "syncing",
    message: `Sinkronisasi booking ${booking.id} ke Fastpik...`,
  });

  const syncedAt = new Date(Date.now() + Math.max(0, syncOffsetMs)).toISOString();

  try {
    const { response, body } = await callFastpikUpsert(profile, booking, {
      locale,
      syncOffsetMs,
    });
    if (response.ok && body?.success) {
      const projectId =
        typeof body.project_id === "string" ? body.project_id : booking.fastpik_project_id;
      const projectLink =
        typeof body.project_link === "string"
          ? body.project_link
          : booking.fastpik_project_link;
      const action = body?.action === "updated" ? "updated" : "created";
      const message =
        action === "updated"
          ? "Project Fastpik berhasil diperbarui."
          : "Project Fastpik berhasil dibuat.";
      await patchBookingSyncState(supabase, booking.id, {
        status: "success",
        message,
        projectId: projectId || null,
        projectLink: projectLink || null,
        at: syncedAt,
      });
      await patchProfileSyncLog(supabase, userId, {
        status: "success",
        message: `${message} (booking ${booking.id})`,
        at: syncedAt,
      });
      return {
        success: true,
        status: "success",
        bookingId: booking.id,
        projectId: projectId || null,
        projectLink: projectLink || null,
        message,
      };
    }

    const message =
      body?.error ||
      body?.message ||
      `Fastpik sync gagal (HTTP ${response.status}).`;
    const status = response.status === 422 ? "warning" : "failed";
    await patchBookingSyncState(supabase, booking.id, {
      status,
      message,
      at: syncedAt,
    });
    await patchProfileSyncLog(supabase, userId, {
      status,
      message,
      at: syncedAt,
    });
    return {
      success: false,
      status,
      bookingId: booking.id,
      message,
    };
  } catch (error: any) {
    const message = error?.name === "AbortError"
      ? "Timeout saat menghubungi Fastpik."
      : error?.message || "Gagal sinkron ke Fastpik.";
    await patchBookingSyncState(supabase, booking.id, {
      status: "failed",
      message,
      at: syncedAt,
    });
    await patchProfileSyncLog(supabase, userId, {
      status: "failed",
      message,
      at: syncedAt,
    });
    return {
      success: false,
      status: "failed",
      bookingId: booking.id,
      message,
    };
  }
}

export async function syncBookingsToFastpikInChunks(params: {
  supabase: any;
  userId: string;
  locale?: string;
  chunkSize?: number;
}): Promise<{
  total: number;
  successCount: number;
  warningCount: number;
  failedCount: number;
  results: SyncResult[];
}> {
  const { supabase, userId, locale = "id", chunkSize = FASTPIK_SYNC_CHUNK_SIZE } =
    params;
  const { data: bookingRows, error } = await supabase
    .from("bookings")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Gagal mengambil daftar booking.");
  }

  const bookingIds = (bookingRows || [])
    .map((row: { id?: string | null }) => (typeof row.id === "string" ? row.id : ""))
    .filter(Boolean);

  const results: SyncResult[] = [];
  let globalIndex = 0;
  for (let start = 0; start < bookingIds.length; start += chunkSize) {
    const chunk = bookingIds.slice(start, start + chunkSize);
    for (const bookingId of chunk) {
      const result = await syncBookingToFastpik({
        supabase,
        userId,
        bookingId,
        locale,
        syncOffsetMs: globalIndex,
        force: true,
      });
      results.push(result);
      globalIndex += 1; // 1ms offset per item
    }
  }

  const successCount = results.filter((item) => item.status === "success").length;
  const warningCount = results.filter((item) => item.status === "warning").length;
  const failedCount = results.filter((item) => item.status === "failed").length;

  const summaryStatus: FastpikSyncStatus =
    failedCount > 0
      ? "failed"
      : warningCount > 0
        ? "warning"
        : successCount > 0
          ? "success"
          : "idle";
  const summaryMessage =
    bookingIds.length === 0
      ? "Tidak ada booking untuk disinkronkan."
      : `Batch sync selesai. Sukses: ${successCount}, warning: ${warningCount}, gagal: ${failedCount}.`;

  await patchProfileSyncLog(supabase, userId, {
    status: summaryStatus,
    message: summaryMessage,
    at: new Date().toISOString(),
  });

  return {
    total: bookingIds.length,
    successCount,
    warningCount,
    failedCount,
    results,
  };
}
