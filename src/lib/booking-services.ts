export type BookingServiceKind = "main" | "addon";

export type BookingServiceRecord = {
  id: string;
  name: string;
  price?: number | null;
  original_price?: number | null;
  description?: string | null;
  duration_minutes?: number | null;
  is_addon?: boolean | null;
  event_types?: string[] | null;
};

export type BookingServiceSelection = {
  id: string;
  booking_service_id?: string | null;
  kind: BookingServiceKind;
  sort_order: number;
  service: BookingServiceRecord;
};

type LegacyBookingServiceRecord = {
  id?: string | null;
  name?: string | null;
  price?: number | null;
  original_price?: number | null;
  description?: string | null;
  duration_minutes?: number | null;
  is_addon?: boolean | null;
  event_types?: unknown;
};

type RawBookingServiceRow = {
  id?: string | null;
  booking_id?: string | null;
  service_id?: string | null;
  kind?: string | null;
  sort_order?: number | null;
  service?: BookingServiceRecord | null;
  services?: BookingServiceRecord | null;
};

export function normalizeBookingServiceSelections(
  rows: unknown,
  legacyService?: unknown,
): BookingServiceSelection[] {
  const selections = Array.isArray(rows)
    ? rows
        .map((row, index) => normalizeBookingServiceRow(row, index))
        .filter((row): row is BookingServiceSelection => row !== null)
    : [];

  if (selections.length > 0) {
    return selections.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "main" ? -1 : 1;
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return a.service.name.localeCompare(b.service.name);
    });
  }

  const normalizedLegacyService = normalizeLegacyServiceRecord(legacyService);
  if (!normalizedLegacyService) return [];

  return [
    {
      id: normalizedLegacyService.id,
      booking_service_id: null,
      kind: normalizedLegacyService.is_addon ? "addon" : "main",
      sort_order: 0,
      service: normalizedLegacyService,
    },
  ];
}

export function normalizeLegacyServiceRecord(
  value: unknown,
): BookingServiceRecord | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || typeof candidate !== "object") return null;

  const raw = candidate as LegacyBookingServiceRecord;
  if (!raw.id || !raw.name) return null;

  return {
    id: raw.id,
    name: raw.name,
    price: raw.price ?? null,
    original_price: raw.original_price ?? null,
    description: raw.description ?? null,
    duration_minutes: raw.duration_minutes ?? null,
    is_addon: raw.is_addon ?? null,
    event_types: Array.isArray(raw.event_types)
      ? raw.event_types.filter((item): item is string => typeof item === "string")
      : null,
  };
}

function normalizeBookingServiceRow(
  row: unknown,
  index: number,
): BookingServiceSelection | null {
  if (!row || typeof row !== "object") return null;

  const raw = row as RawBookingServiceRow;
  const service = normalizeLegacyServiceRecord(raw.service || raw.services);
  if (!service) return null;

  return {
    id: service.id,
    booking_service_id: raw.id || null,
    kind: raw.kind === "addon" ? "addon" : "main",
    sort_order: typeof raw.sort_order === "number" ? raw.sort_order : index,
    service,
  };
}

export function getBookingServicesByKind(
  selections: BookingServiceSelection[],
  kind: BookingServiceKind,
): BookingServiceSelection[] {
  return selections.filter((selection) => selection.kind === kind);
}

export function getBookingServiceNames(
  selections: BookingServiceSelection[],
  kind?: BookingServiceKind,
): string[] {
  return (kind ? getBookingServicesByKind(selections, kind) : selections)
    .map((selection) => selection.service.name)
    .filter(Boolean);
}

export function getBookingServiceLabel(
  selections: BookingServiceSelection[],
  options?: {
    kind?: BookingServiceKind;
    fallback?: string;
    maxNames?: number;
  },
): string {
  const names = getBookingServiceNames(selections, options?.kind);
  if (names.length === 0) return options?.fallback || "-";
  if (!options?.maxNames || names.length <= options.maxNames) {
    return names.join(", ");
  }

  return `${names.slice(0, options.maxNames).join(", ")} +${names.length - options.maxNames}`;
}

export function getPrimaryBookingService(
  selections: BookingServiceSelection[],
): BookingServiceSelection | null {
  return getBookingServicesByKind(selections, "main")[0] || selections[0] || null;
}

export function getBookingServicesTotal(
  selections: BookingServiceSelection[],
  kind?: BookingServiceKind,
): number {
  return (kind ? getBookingServicesByKind(selections, kind) : selections).reduce(
    (sum, selection) => sum + (selection.service.price || 0),
    0,
  );
}

export function normalizeDurationMinutes(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toPositiveMinutes(value: unknown): number {
  const minutes = normalizeDurationMinutes(value);
  return minutes > 0 ? minutes : 0;
}

export function getBookingDurationMinutes(
  selections: BookingServiceSelection[],
  fallbackMinutes = 120,
): number {
  const mainDuration = getBookingServicesByKind(selections, "main").reduce(
    (sum, selection) => sum + toPositiveMinutes(selection.service.duration_minutes),
    0,
  );
  const addonDuration = getBookingServicesByKind(selections, "addon").reduce(
    (sum, selection) => sum + toPositiveMinutes(selection.service.duration_minutes),
    0,
  );
  const totalDuration = mainDuration + addonDuration;
  if (totalDuration > 0) {
    return totalDuration;
  }

  const fallback = toPositiveMinutes(fallbackMinutes);
  return fallback > 0 ? fallback : 120;
}

export function toBookingServicesPayload(
  selections: Array<{ serviceId: string; kind: BookingServiceKind }>,
) {
  return selections.map((selection, index) => ({
    service_id: selection.serviceId,
    kind: selection.kind,
    sort_order: index,
  }));
}

export function getBookingServiceIds(
  selections: BookingServiceSelection[],
  kind?: BookingServiceKind,
): string[] {
  return (kind ? getBookingServicesByKind(selections, kind) : selections).map(
    (selection) => selection.id,
  );
}
