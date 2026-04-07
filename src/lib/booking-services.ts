export type BookingServiceKind = "main" | "addon";

export type BookingServiceRecord = {
  id: string;
  name: string;
  color?: string | null;
  price?: number | null;
  original_price?: number | null;
  description?: string | null;
  duration_minutes?: number | null;
  is_addon?: boolean | null;
  affects_schedule?: boolean | null;
  is_public?: boolean | null;
  event_types?: string[] | null;
};

export type BookingServiceSelection = {
  id: string;
  booking_service_id?: string | null;
  kind: BookingServiceKind;
  sort_order: number;
  quantity: number;
  service: BookingServiceRecord;
};

export type BookingServicePayloadItem = {
  serviceId: string;
  kind: BookingServiceKind;
  quantity?: number | null;
};

export type BookingServiceQuantityMap = Record<string, number>;

type LegacyBookingServiceRecord = {
  id?: string | null;
  name?: string | null;
  color?: string | null;
  price?: number | null;
  original_price?: number | null;
  description?: string | null;
  duration_minutes?: number | null;
  is_addon?: boolean | null;
  affects_schedule?: boolean | null;
  is_public?: boolean | null;
  event_types?: unknown;
};

type RawBookingServiceRow = {
  id?: string | null;
  booking_id?: string | null;
  service_id?: string | null;
  kind?: string | null;
  sort_order?: number | null;
  quantity?: number | string | null;
  service?: BookingServiceRecord | null;
  services?: BookingServiceRecord | null;
};

type RawBookingServicePayloadItem = {
  serviceId?: unknown;
  service_id?: unknown;
  kind?: unknown;
  quantity?: unknown;
};

export function normalizeBookingServiceQuantity(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim())
        : Number.NaN;
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(Math.floor(parsed), 1);
}

export function normalizeBookingServicePayloadItems(
  value: unknown,
  options?: {
    fallbackKind?: BookingServiceKind;
  },
): BookingServicePayloadItem[] {
  if (!Array.isArray(value)) return [];

  const normalized: Array<BookingServicePayloadItem | null> = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const raw = item as RawBookingServicePayloadItem;
      const serviceIdCandidate =
        typeof raw.serviceId === "string"
          ? raw.serviceId
          : typeof raw.service_id === "string"
            ? raw.service_id
            : "";
      const serviceId = serviceIdCandidate.trim();
      if (!serviceId) return null;

      return {
        serviceId,
        kind:
          raw.kind === "addon" || raw.kind === "main"
            ? raw.kind
            : options?.fallbackKind || "main",
        quantity: normalizeBookingServiceQuantity(raw.quantity),
      } satisfies BookingServicePayloadItem;
    });

  return normalized.filter((item): item is BookingServicePayloadItem => item !== null);
}

export function mergeBookingServicePayloadItems(
  selections: BookingServicePayloadItem[],
): BookingServicePayloadItem[] {
  const merged = new Map<string, BookingServicePayloadItem>();

  selections.forEach((selection) => {
    const key = `${selection.kind}:${selection.serviceId}`;
    const current = merged.get(key);
    if (!current) {
      merged.set(key, {
        ...selection,
        quantity: normalizeBookingServiceQuantity(selection.quantity),
      });
      return;
    }

    merged.set(key, {
      ...current,
      quantity:
        normalizeBookingServiceQuantity(current.quantity) +
        normalizeBookingServiceQuantity(selection.quantity),
    });
  });

  return Array.from(merged.values());
}

export function normalizeBookingServiceQuantityMap(
  value: BookingServiceQuantityMap,
  options?: {
    selectedIds?: string[];
    validIds?: Iterable<string>;
    forceSingleUnit?: boolean;
  },
): BookingServiceQuantityMap {
  const selectedIdSet = options?.selectedIds
    ? new Set(options.selectedIds.filter(Boolean))
    : null;
  const validIdSet = options?.validIds ? new Set(options.validIds) : null;
  const next: BookingServiceQuantityMap = {};

  Object.entries(value || {}).forEach(([serviceId, quantity]) => {
    if (!serviceId) return;
    if (selectedIdSet && !selectedIdSet.has(serviceId)) return;
    if (validIdSet && !validIdSet.has(serviceId)) return;
    next[serviceId] = options?.forceSingleUnit
      ? 1
      : normalizeBookingServiceQuantity(quantity);
  });

  if (selectedIdSet) {
    selectedIdSet.forEach((serviceId) => {
      if (!serviceId) return;
      if (validIdSet && !validIdSet.has(serviceId)) return;
      next[serviceId] = options?.forceSingleUnit ? 1 : next[serviceId] || 1;
    });
  }

  return next;
}

export function buildBookingServicePayloadItemsFromSelection(
  selectedIds: string[],
  quantityMap: BookingServiceQuantityMap,
  kind: BookingServiceKind,
): BookingServicePayloadItem[] {
  return selectedIds
    .filter(Boolean)
    .map((serviceId) => ({
      serviceId,
      kind,
      quantity: normalizeBookingServiceQuantity(quantityMap[serviceId]),
    }));
}

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
      quantity: 1,
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
    color: typeof raw.color === "string" ? raw.color : null,
    price: raw.price ?? null,
    original_price: raw.original_price ?? null,
    description: raw.description ?? null,
    duration_minutes: raw.duration_minutes ?? null,
    is_addon: raw.is_addon ?? null,
    affects_schedule: raw.affects_schedule ?? null,
    is_public: raw.is_public ?? null,
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
    quantity: normalizeBookingServiceQuantity(raw.quantity),
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
    .map((selection) =>
      selection.quantity > 1
        ? `${selection.service.name} x${selection.quantity}`
        : selection.service.name,
    )
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
    (sum, selection) =>
      sum + (selection.service.price || 0) * normalizeBookingServiceQuantity(selection.quantity),
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
    (sum, selection) =>
      sum +
      toPositiveMinutes(selection.service.duration_minutes) *
        normalizeBookingServiceQuantity(selection.quantity),
    0,
  );
  const addonDuration = getBookingServicesByKind(selections, "addon").reduce(
    (sum, selection) =>
      selection.service.affects_schedule === false
        ? sum
        : sum +
          toPositiveMinutes(selection.service.duration_minutes) *
            normalizeBookingServiceQuantity(selection.quantity),
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
  selections: BookingServicePayloadItem[],
) {
  return selections.map((selection, index) => ({
    service_id: selection.serviceId,
    kind: selection.kind,
    sort_order: index,
    quantity: normalizeBookingServiceQuantity(selection.quantity),
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
