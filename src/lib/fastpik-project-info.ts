type UnknownRecord = Record<string, unknown>;

export type FastpikProjectInfoSnapshot = {
  password: string | null;
  selection_days: number | null;
  download_days: number | null;
  max_photos: number | null;
  source: string | null;
  synced_at: string | null;
};

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as UnknownRecord;
}

function toTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function toNonNegativeInteger(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim())
        : Number.NaN;
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.floor(parsed);
  return rounded >= 0 ? rounded : null;
}

function getFirstStringValue(
  records: Array<UnknownRecord | null>,
  keys: string[],
): string | null {
  for (const record of records) {
    if (!record) continue;
    for (const key of keys) {
      const value = toTrimmedString(record[key]);
      if (value) return value;
    }
  }
  return null;
}

function getFirstIntegerValue(
  records: Array<UnknownRecord | null>,
  keys: string[],
): number | null {
  for (const record of records) {
    if (!record) continue;
    for (const key of keys) {
      const value = toNonNegativeInteger(record[key]);
      if (value !== null) return value;
    }
  }
  return null;
}

function normalizeFastpikProjectSnapshot(
  value: unknown,
): FastpikProjectInfoSnapshot | null {
  const record = asRecord(value);
  if (!record) return null;

  const snapshot: FastpikProjectInfoSnapshot = {
    password: toTrimmedString(record.password),
    selection_days: toNonNegativeInteger(record.selection_days),
    download_days: toNonNegativeInteger(record.download_days),
    max_photos: toNonNegativeInteger(record.max_photos),
    source: toTrimmedString(record.source),
    synced_at: toTrimmedString(record.synced_at),
  };

  const hasValue = Object.values(snapshot).some((item) => item !== null);
  return hasValue ? snapshot : null;
}

export function resolveFastpikProjectInfoFromExtraFields(
  extraFields: unknown,
): FastpikProjectInfoSnapshot | null {
  const root = asRecord(extraFields);
  if (!root) return null;
  return normalizeFastpikProjectSnapshot(root.fastpik_project);
}

export function buildFastpikProjectInfoSnapshot(input: {
  responsePayload?: unknown;
  defaults?: {
    password?: unknown;
    selection_days?: unknown;
    download_days?: unknown;
    max_photos?: unknown;
  };
  syncedAt?: string;
}): FastpikProjectInfoSnapshot {
  const payloadRoot = asRecord(input.responsePayload);
  const payloadData = asRecord(payloadRoot?.data);
  const payloadResult = asRecord(payloadRoot?.result);
  const payloadProject = asRecord(payloadRoot?.project);
  const payloadConfig = asRecord(payloadRoot?.project_config);
  const payloadClientdeskDefaults = asRecord(payloadRoot?.clientdesk_defaults);

  const payloadCandidates: Array<UnknownRecord | null> = [
    payloadRoot,
    payloadData,
    payloadResult,
    payloadProject,
    payloadConfig,
    payloadClientdeskDefaults,
  ];
  const defaultRecord = asRecord(input.defaults);
  const fallbackCandidates: Array<UnknownRecord | null> = [defaultRecord];

  const passwordKeys = [
    "password",
    "default_password",
    "selection_password",
    "project_password",
  ];
  const selectionDayKeys = [
    "selection_days",
    "selectionDays",
    "link_selection_days",
    "selection_duration_days",
  ];
  const downloadDayKeys = [
    "download_days",
    "downloadDays",
    "link_download_days",
    "download_duration_days",
  ];
  const maxPhotoKeys = [
    "max_photos",
    "maxPhotos",
    "maximum_photos",
    "max_photo_count",
  ];

  const payloadPassword = getFirstStringValue(payloadCandidates, passwordKeys);
  const payloadSelectionDays = getFirstIntegerValue(
    payloadCandidates,
    selectionDayKeys,
  );
  const payloadDownloadDays = getFirstIntegerValue(
    payloadCandidates,
    downloadDayKeys,
  );
  const payloadMaxPhotos = getFirstIntegerValue(payloadCandidates, maxPhotoKeys);

  return {
    password:
      payloadPassword ??
      getFirstStringValue(fallbackCandidates, ["password"]) ??
      null,
    selection_days:
      payloadSelectionDays ??
      getFirstIntegerValue(fallbackCandidates, ["selection_days"]) ??
      null,
    download_days:
      payloadDownloadDays ??
      getFirstIntegerValue(fallbackCandidates, ["download_days"]) ??
      null,
    max_photos:
      payloadMaxPhotos ??
      getFirstIntegerValue(fallbackCandidates, ["max_photos"]) ??
      null,
    source:
      payloadPassword !== null ||
      payloadSelectionDays !== null ||
      payloadDownloadDays !== null ||
      payloadMaxPhotos !== null
        ? "project_response"
        : "profile_default",
    synced_at: toTrimmedString(input.syncedAt) ?? new Date().toISOString(),
  };
}

export function mergeFastpikProjectInfoIntoExtraFields(
  extraFields: unknown,
  snapshot: FastpikProjectInfoSnapshot | null,
): Record<string, unknown> | null {
  const current = asRecord(extraFields);
  const next: Record<string, unknown> = current ? { ...current } : {};

  if (snapshot) {
    next.fastpik_project = snapshot;
  } else {
    delete next.fastpik_project;
  }

  return Object.keys(next).length > 0 ? next : null;
}
