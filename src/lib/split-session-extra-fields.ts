import { parseSessionDateParts } from "@/utils/format-date";

type SplitSessionDateTimes = {
  akad: string | null;
  resepsi: string | null;
  wisudaSession1: string | null;
  wisudaSession2: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readFirstString(
  source: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function isValidDateTime(value: string | null) {
  if (!value) return false;
  return Boolean(parseSessionDateParts(value));
}

function hasExplicitTime(value: string) {
  return /[T\s]\d{2}:\d{2}/.test(value);
}

function normalizeLegacyTime(raw: string | null) {
  if (!raw) return null;
  const normalized = raw.trim().replace(/\./g, ":");
  if (!normalized) return null;

  const match = normalized.match(/^(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?$/);
  if (!match) return null;

  const hours = Number(match[1] || "0");
  const minutes = Number(match[2] || "0");
  const seconds = Number(match[3] || "0");
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    !Number.isInteger(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }

  const hourLabel = String(hours).padStart(2, "0");
  const minuteLabel = String(minutes).padStart(2, "0");
  if (match[3]) {
    return `${hourLabel}:${minuteLabel}:${String(seconds).padStart(2, "0")}`;
  }
  return `${hourLabel}:${minuteLabel}`;
}

function resolveCanonicalOrLegacyDateTime(
  source: Record<string, unknown>,
  options: {
    canonicalKey: string;
    legacyDateKeys: string[];
    legacyTimeKeys: string[];
  },
) {
  const canonical = readFirstString(source, [options.canonicalKey]);
  if (isValidDateTime(canonical)) {
    return canonical;
  }

  const legacyDate = readFirstString(source, options.legacyDateKeys);
  if (!isValidDateTime(legacyDate)) {
    return null;
  }

  if (!legacyDate) return null;
  if (hasExplicitTime(legacyDate)) {
    return legacyDate;
  }

  const legacyTime = normalizeLegacyTime(
    readFirstString(source, options.legacyTimeKeys),
  );
  if (!legacyTime) {
    return legacyDate;
  }

  const merged = `${legacyDate}T${legacyTime}`;
  return isValidDateTime(merged) ? merged : legacyDate;
}

export function resolveSplitSessionDateTimes(
  extraFields: unknown,
): SplitSessionDateTimes {
  const source = asRecord(extraFields);

  return {
    akad: resolveCanonicalOrLegacyDateTime(source, {
      canonicalKey: "tanggal_akad",
      legacyDateKeys: ["akad_date"],
      legacyTimeKeys: ["akad_time"],
    }),
    resepsi: resolveCanonicalOrLegacyDateTime(source, {
      canonicalKey: "tanggal_resepsi",
      legacyDateKeys: ["resepsi_date"],
      legacyTimeKeys: ["resepsi_time"],
    }),
    wisudaSession1: resolveCanonicalOrLegacyDateTime(source, {
      canonicalKey: "tanggal_wisuda_1",
      legacyDateKeys: ["wisuda_session_1_date", "wisuda_session1_date"],
      legacyTimeKeys: ["wisuda_session_1_time", "wisuda_session1_time"],
    }),
    wisudaSession2: resolveCanonicalOrLegacyDateTime(source, {
      canonicalKey: "tanggal_wisuda_2",
      legacyDateKeys: ["wisuda_session_2_date", "wisuda_session2_date"],
      legacyTimeKeys: ["wisuda_session_2_time", "wisuda_session2_time"],
    }),
  };
}
