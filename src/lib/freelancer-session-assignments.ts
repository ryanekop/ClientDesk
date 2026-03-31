type NormalizeFreelancerIdsOptions = {
  validFreelancerIds?: Set<string>;
  maxItems?: number;
};

type NormalizeSessionAssignmentsOptions = NormalizeFreelancerIdsOptions & {
  preserveEmpty?: boolean;
};

export const FREELANCER_ASSIGNMENTS_EXTRA_FIELD_KEY =
  "freelancer_assignments_by_session";
export const MAX_FREELANCERS_PER_SESSION = 5;

export type SessionFreelancerAssignments = Record<string, string[]>;

export const SESSION_FREELANCER_LABELS: Record<string, string> = {
  akad: "Akad",
  resepsi: "Resepsi",
  wisuda_session_1: "Sesi 1",
  wisuda_session_2: "Sesi 2",
  primary: "Sesi Utama",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeId(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeFreelancerIdList(
  value: unknown,
  options?: NormalizeFreelancerIdsOptions,
) {
  const maxItems =
    typeof options?.maxItems === "number" && options.maxItems > 0
      ? options.maxItems
      : Number.POSITIVE_INFINITY;
  const validFreelancerIds = options?.validFreelancerIds;
  const values = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const item of values) {
    const id = normalizeId(item);
    if (!id) continue;
    if (validFreelancerIds && !validFreelancerIds.has(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    normalized.push(id);
    if (normalized.length >= maxItems) break;
  }

  return normalized;
}

export function normalizeSessionFreelancerAssignments(
  value: unknown,
  options?: NormalizeSessionAssignmentsOptions,
): SessionFreelancerAssignments {
  if (!isRecord(value)) return {};

  const normalized: SessionFreelancerAssignments = {};
  const preserveEmpty = Boolean(options?.preserveEmpty);
  for (const [sessionKey, freelancerIds] of Object.entries(value)) {
    const normalizedKey = normalizeId(sessionKey);
    if (!normalizedKey) continue;
    const ids = normalizeFreelancerIdList(freelancerIds, options);
    if (ids.length > 0 || preserveEmpty) {
      normalized[normalizedKey] = ids;
    }
  }

  return normalized;
}

export function readSessionFreelancerAssignmentsFromExtraFields(
  extraFields: unknown,
  options?: NormalizeSessionAssignmentsOptions,
) {
  if (!isRecord(extraFields)) return {};
  return normalizeSessionFreelancerAssignments(
    extraFields[FREELANCER_ASSIGNMENTS_EXTRA_FIELD_KEY],
    options,
  );
}

export function buildSessionFreelancerUnion(
  assignments: SessionFreelancerAssignments,
  sessionKeys?: string[],
) {
  const seen = new Set<string>();
  const merged: string[] = [];
  const keys = Array.isArray(sessionKeys)
    ? sessionKeys
    : Object.keys(assignments || {});

  for (const key of keys) {
    const values = Array.isArray(assignments?.[key]) ? assignments[key] : [];
    for (const value of values) {
      const id = normalizeId(value);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      merged.push(id);
    }
  }

  return merged;
}

export function ensureAssignmentsForSessionKeys(args: {
  assignments: SessionFreelancerAssignments;
  sessionKeys: string[];
  fallbackFreelancerIds?: string[];
  validFreelancerIds?: Set<string>;
  maxPerSession?: number;
}) {
  const maxPerSession =
    typeof args.maxPerSession === "number" && args.maxPerSession > 0
      ? args.maxPerSession
      : MAX_FREELANCERS_PER_SESSION;
  const normalizedSource = normalizeSessionFreelancerAssignments(
    args.assignments,
    {
      validFreelancerIds: args.validFreelancerIds,
      maxItems: maxPerSession,
      preserveEmpty: true,
    },
  );
  const fallbackFreelancerIds = normalizeFreelancerIdList(
    args.fallbackFreelancerIds || [],
    {
      validFreelancerIds: args.validFreelancerIds,
      maxItems: maxPerSession,
    },
  );
  const next: SessionFreelancerAssignments = {};

  for (const key of args.sessionKeys) {
    const normalizedKey = normalizeId(key);
    if (!normalizedKey) continue;
    if (Object.prototype.hasOwnProperty.call(normalizedSource, normalizedKey)) {
      next[normalizedKey] = normalizedSource[normalizedKey];
    } else {
      next[normalizedKey] = [...fallbackFreelancerIds];
    }
  }

  return next;
}

export function resolveSplitFreelancerSessionKeys(args: {
  eventType?: string | null;
  splitDates: boolean;
}) {
  if (!args.splitDates) return [] as string[];

  const normalizedEventType =
    typeof args.eventType === "string" ? args.eventType.trim().toLowerCase() : "";
  if (normalizedEventType === "wedding") {
    return ["akad", "resepsi"];
  }
  if (normalizedEventType === "wisuda") {
    return ["wisuda_session_1", "wisuda_session_2"];
  }

  return [] as string[];
}
