export type BookingCalendarSession = {
  key: string;
  label: string | null;
  titlePrefix: string;
  sessionDate: string;
  location: string | null;
};

export type BookingCalendarEventIdMap = Record<string, string>;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeDateValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return normalized;
}

export function resolveBookingCalendarSessions({
  eventType,
  sessionDate,
  extraFields,
  defaultLocation,
}: {
  eventType?: string | null;
  sessionDate?: string | null;
  extraFields?: unknown;
  defaultLocation?: string | null;
}): BookingCalendarSession[] {
  const sessions: BookingCalendarSession[] = [];
  const normalizedEventType = (eventType || "").trim().toLowerCase();
  const extras = asRecord(extraFields);

  if (normalizedEventType === "wedding") {
    const akadDate = normalizeDateValue(extras.tanggal_akad);
    const resepsiDate = normalizeDateValue(extras.tanggal_resepsi);

    if (akadDate) {
      sessions.push({
        key: "akad",
        label: "Akad",
        titlePrefix: "[Akad]",
        sessionDate: akadDate,
        location:
          typeof extras.tempat_akad === "string" && extras.tempat_akad.trim()
            ? extras.tempat_akad.trim()
            : defaultLocation || null,
      });
    }

    if (resepsiDate) {
      sessions.push({
        key: "resepsi",
        label: "Resepsi",
        titlePrefix: "[Resepsi]",
        sessionDate: resepsiDate,
        location:
          typeof extras.tempat_resepsi === "string" && extras.tempat_resepsi.trim()
            ? extras.tempat_resepsi.trim()
            : defaultLocation || null,
      });
    }
  }

  const sortedSplitSessions = sessions.sort(
    (a, b) =>
      new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime(),
  );
  if (sortedSplitSessions.length > 0) {
    return sortedSplitSessions;
  }

  const normalizedSessionDate = normalizeDateValue(sessionDate);
  if (!normalizedSessionDate) {
    return [];
  }

  return [
    {
      key: "primary",
      label: null,
      titlePrefix: "",
      sessionDate: normalizedSessionDate,
      location: defaultLocation || null,
    },
  ];
}

export function hasBookingCalendarSessions(args: {
  eventType?: string | null;
  sessionDate?: string | null;
  extraFields?: unknown;
  defaultLocation?: string | null;
}) {
  return resolveBookingCalendarSessions(args).length > 0;
}

export function normalizeGoogleCalendarEventIds(
  raw: unknown,
  fallbackEventId?: string | null,
): BookingCalendarEventIdMap {
  const normalized: BookingCalendarEventIdMap = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    Object.entries(raw as Record<string, unknown>).forEach(([key, value]) => {
      if (typeof value === "string" && value.trim()) {
        normalized[key] = value.trim();
      }
    });
  }

  if (fallbackEventId && fallbackEventId.trim() && !normalized.primary) {
    normalized.primary = fallbackEventId.trim();
  }

  return normalized;
}
