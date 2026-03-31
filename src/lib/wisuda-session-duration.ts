import type { BookingCalendarSession } from "@/lib/booking-calendar-sessions";
import { normalizeDurationMinutes } from "@/lib/booking-services";

type UnknownRecord = Record<string, unknown>;

const WISUDA_DURATION_EXTRA_FIELD_KEY = "wisuda_session_duration_minutes";

type WisudaSessionKey = "wisuda_session_1" | "wisuda_session_2";

export type WisudaSessionDurationOverride = Record<WisudaSessionKey, number>;

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as UnknownRecord;
}

function toPositiveInteger(value: unknown): number | null {
  const normalized = normalizeDurationMinutes(value);
  if (!Number.isFinite(normalized) || normalized <= 0) return null;
  const integer = Math.floor(normalized);
  return integer > 0 ? integer : null;
}

function normalizeTotalDurationMinutes(value: unknown, fallbackMinutes = 120): number {
  const normalized = toPositiveInteger(value);
  if (normalized) return normalized;
  const fallback = toPositiveInteger(fallbackMinutes);
  return fallback || 120;
}

function isWisudaEventType(eventType: string | null | undefined) {
  return (eventType || "").trim().toLowerCase() === "wisuda";
}

function hasWisudaSplitSessions(sessions: BookingCalendarSession[]) {
  const keys = new Set(sessions.map((session) => session.key));
  return keys.has("wisuda_session_1") && keys.has("wisuda_session_2");
}

function splitEvenly(totalDurationMinutes: number, count: number): number[] {
  const safeCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 1;
  const safeTotal = Math.max(normalizeTotalDurationMinutes(totalDurationMinutes), safeCount);
  const base = Math.floor(safeTotal / safeCount);
  let remainder = safeTotal % safeCount;
  const result = Array.from({ length: safeCount }, () => base);

  for (let index = 0; index < result.length && remainder > 0; index += 1) {
    result[index] += 1;
    remainder -= 1;
  }

  return result.map((value) => (value > 0 ? value : 1));
}

export function getWisudaSessionDurationExtraFieldKey() {
  return WISUDA_DURATION_EXTRA_FIELD_KEY;
}

export function buildWisudaSessionDurationOverride(input: {
  session1Minutes: unknown;
  session2Minutes: unknown;
}): WisudaSessionDurationOverride | null {
  const session1 = toPositiveInteger(input.session1Minutes);
  const session2 = toPositiveInteger(input.session2Minutes);
  if (!session1 || !session2) return null;

  return {
    wisuda_session_1: session1,
    wisuda_session_2: session2,
  };
}

export function parseWisudaSessionDurationOverride(
  extraFields: unknown,
): WisudaSessionDurationOverride | null {
  const root = asRecord(extraFields);
  if (!root) return null;
  const rawOverride = asRecord(root[WISUDA_DURATION_EXTRA_FIELD_KEY]);
  if (!rawOverride) return null;

  return buildWisudaSessionDurationOverride({
    session1Minutes: rawOverride.wisuda_session_1,
    session2Minutes: rawOverride.wisuda_session_2,
  });
}

export function resolveSessionDurationMinutesBySessionKey(args: {
  eventType?: string | null;
  sessions: BookingCalendarSession[];
  totalDurationMinutes: number;
  extraFields?: unknown;
  fallbackMinutes?: number;
}): Record<string, number> {
  const { sessions } = args;
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return {};
  }

  const totalDuration = normalizeTotalDurationMinutes(
    args.totalDurationMinutes,
    args.fallbackMinutes,
  );

  if (!isWisudaEventType(args.eventType) || !hasWisudaSplitSessions(sessions)) {
    return Object.fromEntries(
      sessions.map((session) => [session.key, totalDuration]),
    );
  }

  const parsedOverride = parseWisudaSessionDurationOverride(args.extraFields);
  if (
    parsedOverride &&
    parsedOverride.wisuda_session_1 + parsedOverride.wisuda_session_2 === totalDuration
  ) {
    return Object.fromEntries(
      sessions.map((session) => {
        if (session.key === "wisuda_session_1") {
          return [session.key, parsedOverride.wisuda_session_1];
        }
        if (session.key === "wisuda_session_2") {
          return [session.key, parsedOverride.wisuda_session_2];
        }
        return [session.key, totalDuration];
      }),
    );
  }

  const [session1Minutes, session2Minutes] = splitEvenly(totalDuration, 2);
  return Object.fromEntries(
    sessions.map((session) => {
      if (session.key === "wisuda_session_1") {
        return [session.key, session1Minutes];
      }
      if (session.key === "wisuda_session_2") {
        return [session.key, session2Minutes];
      }
      return [session.key, totalDuration];
    }),
  );
}
