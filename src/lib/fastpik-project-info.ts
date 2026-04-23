type UnknownRecord = Record<string, unknown>;

export type FastpikProjectInfoSnapshot = {
  password: string | null;
  selection_days: number | null;
  download_days: number | null;
  print_days: number | null;
  max_photos: number | null;
  detect_subfolders: boolean | null;
  selection_enabled: boolean | null;
  download_enabled: boolean | null;
  print_enabled: boolean | null;
  print_template_label: string | null;
  print_template_description: string | null;
  print_size_label: string | null;
  print_size_description: string | null;
  print_template_raw: UnknownRecord | null;
  project_type: string | null;
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

function toNullableBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (
      normalized === "true" ||
      normalized === "1" ||
      normalized === "yes" ||
      normalized === "on" ||
      normalized === "enabled"
    ) {
      return true;
    }
    if (
      normalized === "false" ||
      normalized === "0" ||
      normalized === "no" ||
      normalized === "off" ||
      normalized === "disabled"
    ) {
      return false;
    }
  }
  return null;
}

type ResolvedField<T> = {
  found: boolean;
  value: T | null;
};

function hasOwnKey(record: UnknownRecord, key: string) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function resolveFirstStringField(
  records: Array<UnknownRecord | null>,
  keys: string[],
): ResolvedField<string> {
  for (const record of records) {
    if (!record) continue;
    for (const key of keys) {
      if (!hasOwnKey(record, key)) continue;
      return {
        found: true,
        value: toTrimmedString(record[key]),
      };
    }
  }
  return { found: false, value: null };
}

function resolveFirstIntegerField(
  records: Array<UnknownRecord | null>,
  keys: string[],
): ResolvedField<number> {
  for (const record of records) {
    if (!record) continue;
    for (const key of keys) {
      if (!hasOwnKey(record, key)) continue;
      return {
        found: true,
        value: toNonNegativeInteger(record[key]),
      };
    }
  }
  return { found: false, value: null };
}

function resolveFirstBooleanField(
  records: Array<UnknownRecord | null>,
  keys: string[],
): ResolvedField<boolean> {
  for (const record of records) {
    if (!record) continue;
    for (const key of keys) {
      if (!hasOwnKey(record, key)) continue;
      return {
        found: true,
        value: toNullableBoolean(record[key]),
      };
    }
  }
  return { found: false, value: null };
}

function resolveFirstUnknownField(
  records: Array<UnknownRecord | null>,
  keys: string[],
): ResolvedField<unknown> {
  for (const record of records) {
    if (!record) continue;
    for (const key of keys) {
      if (!hasOwnKey(record, key)) continue;
      return {
        found: true,
        value: record[key],
      };
    }
  }
  return { found: false, value: null };
}

type FastpikPrintDisplayDetail = {
  label: string | null;
  description: string | null;
  raw: UnknownRecord | null;
};

function normalizeFastpikPrintDisplayDetail(
  value: unknown,
): FastpikPrintDisplayDetail {
  if (typeof value === "string") {
    return {
      label: toTrimmedString(value),
      description: null,
      raw: null,
    };
  }

  const record = asRecord(value);
  if (!record) {
    return {
      label: null,
      description: null,
      raw: null,
    };
  }

  const label = resolveFirstStringField(
    [record],
    [
      "label",
      "name",
      "title",
      "template_name",
      "templateName",
      "value",
      "text",
      "size_label",
      "sizeLabel",
      "print_size",
      "printSize",
    ],
  ).value;
  const description = resolveFirstStringField(
    [record],
    [
      "description",
      "summary",
      "subtitle",
      "details",
      "helper_text",
      "helperText",
      "note",
    ],
  ).value;

  return {
    label,
    description,
    raw: record,
  };
}

function normalizeFastpikProjectSnapshot(
  value: unknown,
): FastpikProjectInfoSnapshot | null {
  const record = asRecord(value);
  if (!record) return null;

  const printTemplateRaw = asRecord(record.print_template_raw);
  const parsedPrintTemplateRaw = normalizeFastpikPrintDisplayDetail(printTemplateRaw);
  const parsedPrintSizeRaw = normalizeFastpikPrintDisplayDetail(
    printTemplateRaw
      ? resolveFirstUnknownField(
          [printTemplateRaw],
          [
            "print_size",
            "printSize",
            "size",
            "size_label",
            "sizeLabel",
            "selected_print_size",
            "selectedPrintSize",
            "ukuran_cetak",
            "ukuranCetak",
          ],
        ).value
      : null,
  );

  const snapshot: FastpikProjectInfoSnapshot = {
    password: toTrimmedString(record.password),
    selection_days: toNonNegativeInteger(record.selection_days),
    download_days: toNonNegativeInteger(record.download_days),
    print_days: toNonNegativeInteger(record.print_days),
    max_photos: toNonNegativeInteger(record.max_photos),
    detect_subfolders: toNullableBoolean(record.detect_subfolders),
    selection_enabled: toNullableBoolean(record.selection_enabled),
    download_enabled: toNullableBoolean(record.download_enabled),
    print_enabled: toNullableBoolean(record.print_enabled),
    print_template_label:
      toTrimmedString(record.print_template_label) ?? parsedPrintTemplateRaw.label,
    print_template_description:
      toTrimmedString(record.print_template_description) ??
      parsedPrintTemplateRaw.description,
    print_size_label:
      toTrimmedString(record.print_size_label) ?? parsedPrintSizeRaw.label,
    print_size_description:
      toTrimmedString(record.print_size_description) ??
      parsedPrintSizeRaw.description,
    print_template_raw: printTemplateRaw,
    project_type: toTrimmedString(record.project_type),
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
  fallbackSnapshot?: FastpikProjectInfoSnapshot | null;
  syncedAt?: string;
}): FastpikProjectInfoSnapshot {
  const payloadRoot = asRecord(input.responsePayload);
  const payloadProjectInfo = asRecord(payloadRoot?.project_info);
  const payloadProjectInfoAlt = asRecord(payloadRoot?.projectInfo);
  const payloadData = asRecord(payloadRoot?.data);
  const payloadResult = asRecord(payloadRoot?.result);
  const payloadProject = asRecord(payloadRoot?.project);
  const payloadConfig = asRecord(payloadRoot?.project_config);
  const payloadClientdeskDefaults = asRecord(payloadRoot?.clientdesk_defaults);

  const payloadCandidates: Array<UnknownRecord | null> = [
    payloadProjectInfo,
    payloadProjectInfoAlt,
    payloadProject,
    payloadData,
    payloadResult,
    payloadConfig,
    payloadClientdeskDefaults,
    payloadRoot,
  ];
  const fallbackSnapshotRecord = asRecord(input.fallbackSnapshot);
  const fallbackCandidates: Array<UnknownRecord | null> = [
    fallbackSnapshotRecord,
  ];

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
  const printDayKeys = [
    "print_days",
    "printDays",
    "print_selection_days",
    "print_duration_days",
  ];
  const maxPhotoKeys = [
    "max_photos",
    "maxPhotos",
    "maximum_photos",
    "max_photo_count",
  ];
  const detectSubfolderKeys = ["detect_subfolders", "detectSubfolders"];
  const selectionEnabledKeys = ["selection_enabled", "selectionEnabled"];
  const downloadEnabledKeys = ["download_enabled", "downloadEnabled"];
  const printEnabledKeys = ["print_enabled", "printEnabled"];
  const projectTypeKeys = ["project_type", "projectType"];
  const printTemplateKeys = [
    "print_template",
    "printTemplate",
    "selected_print_template",
    "selectedPrintTemplate",
    "print_template_detail",
    "printTemplateDetail",
    "template_cetak",
    "templateCetak",
  ];
  const printSizeKeys = [
    "print_size",
    "printSize",
    "size",
    "size_label",
    "sizeLabel",
    "selected_print_size",
    "selectedPrintSize",
    "ukuran_cetak",
    "ukuranCetak",
  ];

  const payloadPassword = resolveFirstStringField(payloadCandidates, passwordKeys);
  const payloadSelectionDays = resolveFirstIntegerField(
    payloadCandidates,
    selectionDayKeys,
  );
  const payloadDownloadDays = resolveFirstIntegerField(
    payloadCandidates,
    downloadDayKeys,
  );
  const payloadPrintDays = resolveFirstIntegerField(payloadCandidates, printDayKeys);
  const payloadMaxPhotos = resolveFirstIntegerField(
    payloadCandidates,
    maxPhotoKeys,
  );
  const payloadDetectSubfolders = resolveFirstBooleanField(
    payloadCandidates,
    detectSubfolderKeys,
  );
  const payloadSelectionEnabled = resolveFirstBooleanField(
    payloadCandidates,
    selectionEnabledKeys,
  );
  const payloadDownloadEnabled = resolveFirstBooleanField(
    payloadCandidates,
    downloadEnabledKeys,
  );
  const payloadPrintEnabled = resolveFirstBooleanField(
    payloadCandidates,
    printEnabledKeys,
  );
  const payloadProjectType = resolveFirstStringField(
    payloadCandidates,
    projectTypeKeys,
  );
  const payloadPrintTemplate = resolveFirstUnknownField(
    payloadCandidates,
    printTemplateKeys,
  );
  const payloadPrintSize = resolveFirstUnknownField(payloadCandidates, printSizeKeys);

  const parsedPrintTemplate = normalizeFastpikPrintDisplayDetail(
    payloadPrintTemplate.value,
  );
  const nestedPrintSize = parsedPrintTemplate.raw
    ? resolveFirstUnknownField([parsedPrintTemplate.raw], printSizeKeys)
    : { found: false, value: null };
  const parsedPrintSize = normalizeFastpikPrintDisplayDetail(
    payloadPrintSize.found ? payloadPrintSize.value : nestedPrintSize.value,
  );

  return {
    password:
      payloadPassword.found
        ? payloadPassword.value
        : resolveFirstStringField(fallbackCandidates, ["password"]).value,
    selection_days:
      payloadSelectionDays.found
        ? payloadSelectionDays.value
        : resolveFirstIntegerField(fallbackCandidates, ["selection_days"]).value,
    download_days:
      payloadDownloadDays.found
        ? payloadDownloadDays.value
        : resolveFirstIntegerField(fallbackCandidates, ["download_days"]).value,
    print_days:
      payloadPrintDays.found
        ? payloadPrintDays.value
        : resolveFirstIntegerField(fallbackCandidates, ["print_days"]).value,
    max_photos:
      payloadMaxPhotos.found
        ? payloadMaxPhotos.value
        : resolveFirstIntegerField(fallbackCandidates, ["max_photos"]).value,
    detect_subfolders:
      payloadDetectSubfolders.found
        ? payloadDetectSubfolders.value
        : resolveFirstBooleanField(fallbackCandidates, ["detect_subfolders"]).value,
    selection_enabled:
      payloadSelectionEnabled.found
        ? payloadSelectionEnabled.value
        : resolveFirstBooleanField(fallbackCandidates, ["selection_enabled"]).value,
    download_enabled:
      payloadDownloadEnabled.found
        ? payloadDownloadEnabled.value
        : resolveFirstBooleanField(fallbackCandidates, ["download_enabled"]).value,
    print_enabled:
      payloadPrintEnabled.found
        ? payloadPrintEnabled.value
        : resolveFirstBooleanField(fallbackCandidates, ["print_enabled"]).value,
    print_template_label:
      payloadPrintTemplate.found
        ? parsedPrintTemplate.label
        : resolveFirstStringField(
            fallbackCandidates,
            ["print_template_label"],
          ).value,
    print_template_description:
      payloadPrintTemplate.found
        ? parsedPrintTemplate.description
        : resolveFirstStringField(
            fallbackCandidates,
            ["print_template_description"],
          ).value,
    print_size_label:
      payloadPrintSize.found || nestedPrintSize.found
        ? parsedPrintSize.label
        : resolveFirstStringField(fallbackCandidates, ["print_size_label"]).value,
    print_size_description:
      payloadPrintSize.found || nestedPrintSize.found
        ? parsedPrintSize.description
        : resolveFirstStringField(
            fallbackCandidates,
            ["print_size_description"],
          ).value,
    print_template_raw:
      payloadPrintTemplate.found && parsedPrintTemplate.raw
        ? parsedPrintTemplate.raw
        : asRecord(input.fallbackSnapshot?.print_template_raw),
    project_type:
      payloadProjectType.found
        ? payloadProjectType.value
        : resolveFirstStringField(fallbackCandidates, ["project_type"]).value,
    source:
      payloadPassword.found ||
      payloadSelectionDays.found ||
      payloadDownloadDays.found ||
      payloadPrintDays.found ||
      payloadMaxPhotos.found ||
      payloadDetectSubfolders.found ||
      payloadSelectionEnabled.found ||
      payloadDownloadEnabled.found ||
      payloadPrintEnabled.found ||
      payloadPrintTemplate.found ||
      payloadPrintSize.found ||
      nestedPrintSize.found ||
      payloadProjectType.found
        ? "project_response"
        : input.fallbackSnapshot?.source ?? null,
    synced_at:
      toTrimmedString(input.syncedAt) ??
      input.fallbackSnapshot?.synced_at ??
      new Date().toISOString(),
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
