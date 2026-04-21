export const DEFAULT_AUTO_DEADLINE_DAYS = 7;

export type ClientStatusDeadlineRule = {
  enabled: boolean;
  days: number;
};

export type ClientStatusDeadlineRules = Record<string, ClientStatusDeadlineRule>;

function normalizeStatusLabel(value: string | null | undefined) {
  return (value || "").trim();
}

function normalizePositiveDays(value: unknown) {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  if (!Number.isFinite(numericValue)) return 0;
  return Math.max(0, Math.floor(numericValue));
}

function toDateOnlyString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateOnlyString(value: string | null | undefined) {
  const normalized = normalizeStatusLabel(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;

  const [yearText, monthText, dayText] = normalized.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

export function normalizeProjectDeadlineDate(value: string | null | undefined) {
  const parsed = parseDateOnlyString(value);
  return parsed ? toDateOnlyString(parsed) : null;
}

export function normalizeClientStatusDeadlineRules(
  value: unknown,
  statuses?: string[] | null,
): ClientStatusDeadlineRules {
  const normalized: ClientStatusDeadlineRules = {};
  const allowedStatuses = Array.isArray(statuses)
    ? new Set(statuses.map((status) => normalizeStatusLabel(status)).filter(Boolean))
    : null;

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return normalized;
  }

  for (const [rawStatus, rawRule] of Object.entries(value)) {
    const status = normalizeStatusLabel(rawStatus);
    if (!status) continue;
    if (allowedStatuses && !allowedStatuses.has(status)) continue;
    if (!rawRule || typeof rawRule !== "object" || Array.isArray(rawRule)) continue;

    const ruleRecord = rawRule as Record<string, unknown>;
    const enabled =
      typeof ruleRecord.enabled === "boolean" ? ruleRecord.enabled : true;
    const days = normalizePositiveDays(ruleRecord.days);
    if (!enabled || days <= 0) continue;

    normalized[status] = {
      enabled: true,
      days,
    };
  }

  return normalized;
}

export function getClientStatusDeadlineRule(
  rules: ClientStatusDeadlineRules | null | undefined,
  status: string | null | undefined,
) {
  const normalizedStatus = normalizeStatusLabel(status);
  if (!normalizedStatus) return null;
  const rule = rules?.[normalizedStatus];
  if (!rule?.enabled || rule.days <= 0) return null;
  return {
    enabled: true,
    days: normalizePositiveDays(rule.days),
  } satisfies ClientStatusDeadlineRule;
}

export function upsertClientStatusDeadlineRule(
  rules: ClientStatusDeadlineRules | null | undefined,
  status: string,
  nextRule: { enabled: boolean; days: number },
) {
  const normalizedStatus = normalizeStatusLabel(status);
  const nextRules = { ...(rules || {}) };

  if (!normalizedStatus || !nextRule.enabled || normalizePositiveDays(nextRule.days) <= 0) {
    delete nextRules[normalizedStatus];
    return normalizeClientStatusDeadlineRules(nextRules);
  }

  nextRules[normalizedStatus] = {
    enabled: true,
    days: normalizePositiveDays(nextRule.days),
  };
  return normalizeClientStatusDeadlineRules(nextRules);
}

export function removeClientStatusDeadlineRule(
  rules: ClientStatusDeadlineRules | null | undefined,
  status: string,
) {
  const normalizedStatus = normalizeStatusLabel(status);
  const nextRules = { ...(rules || {}) };
  delete nextRules[normalizedStatus];
  return normalizeClientStatusDeadlineRules(nextRules);
}

export function renameClientStatusDeadlineRule(
  rules: ClientStatusDeadlineRules | null | undefined,
  previousStatus: string,
  nextStatus: string,
) {
  const normalizedPreviousStatus = normalizeStatusLabel(previousStatus);
  const normalizedNextStatus = normalizeStatusLabel(nextStatus);
  const nextRules = { ...(rules || {}) };
  const existingRule = nextRules[normalizedPreviousStatus];

  if (!normalizedPreviousStatus || !existingRule) {
    return normalizeClientStatusDeadlineRules(nextRules);
  }

  delete nextRules[normalizedPreviousStatus];
  if (!normalizedNextStatus || Object.prototype.hasOwnProperty.call(nextRules, normalizedNextStatus)) {
    return normalizeClientStatusDeadlineRules(nextRules);
  }

  nextRules[normalizedNextStatus] = existingRule;
  return normalizeClientStatusDeadlineRules(nextRules);
}

export function calculateAutoProjectDeadlineDate(
  days: number,
  now: Date = new Date(),
) {
  const safeDays = normalizePositiveDays(days);
  if (safeDays <= 0) return null;

  const nextDate = new Date(now);
  nextDate.setHours(0, 0, 0, 0);
  nextDate.setDate(nextDate.getDate() + safeDays);
  return toDateOnlyString(nextDate);
}

export function resolveAutoProjectDeadlineDate(params: {
  currentDeadlineDate?: string | null;
  nextStatus?: string | null;
  rules?: ClientStatusDeadlineRules | null;
  now?: Date;
}) {
  const currentDeadlineDate = normalizeProjectDeadlineDate(params.currentDeadlineDate);
  if (currentDeadlineDate) {
    return null;
  }

  const rule = getClientStatusDeadlineRule(params.rules, params.nextStatus);
  if (!rule) return null;

  return calculateAutoProjectDeadlineDate(rule.days, params.now);
}

export function formatProjectDeadlineDate(
  value: string | null | undefined,
  locale: "id" | "en" = "id",
) {
  const parsed = parseDateOnlyString(value);
  if (!parsed) return "-";
  return parsed.toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function getProjectDeadlineCountdownLabel(
  value: string | null | undefined,
  locale: "id" | "en" = "id",
  now: Date = new Date(),
) {
  const parsed = parseDateOnlyString(value);
  if (!parsed) return "";

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const diffMs = parsed.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / 86400000);

  if (diffDays === 0) {
    return locale === "en" ? "Today" : "Hari ini";
  }
  if (diffDays === 1) {
    return locale === "en" ? "Tomorrow" : "Besok";
  }
  if (diffDays > 1) {
    return locale === "en" ? `${diffDays} days left` : `${diffDays} hari lagi`;
  }
  if (diffDays === -1) {
    return locale === "en" ? "Overdue 1 day" : "Terlambat 1 hari";
  }
  const overdueDays = Math.abs(diffDays);
  return locale === "en"
    ? `Overdue ${overdueDays} days`
    : `Terlambat ${overdueDays} hari`;
}
