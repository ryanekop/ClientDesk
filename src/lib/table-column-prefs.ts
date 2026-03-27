export type TableMenuKey = "bookings" | "client_status" | "finance" | "team";

export type TableColumnPin = "left" | "right" | null;

export type TableColumnPreference = {
  id: string;
  label: string;
  visible: boolean;
  locked?: boolean;
  pin?: TableColumnPin;
};

export type TableColumnPreferenceMap = Record<TableMenuKey, TableColumnPreference[]>;

type RawTableColumnPreference = {
  id: string;
  label: string;
  visible?: boolean;
  locked?: boolean;
  pin?: unknown;
};

function normalizeTableColumnPin(value: unknown): TableColumnPin {
  if (value === "left" || value === "right") return value;
  return null;
}

function normalizeTableColumnPreferenceItem(
  item: unknown,
): TableColumnPreference | null {
  if (!item || typeof item !== "object") return null;
  const raw = item as Partial<RawTableColumnPreference>;
  if (typeof raw.id !== "string" || typeof raw.label !== "string") return null;

  return {
    id: raw.id,
    label: raw.label,
    visible: raw.visible !== false,
    locked: raw.locked === true,
    pin: normalizeTableColumnPin(raw.pin),
  };
}

export function normalizePinnedColumnOrder(
  columns: TableColumnPreference[],
): TableColumnPreference[] {
  const leftPinned: TableColumnPreference[] = [];
  const unpinned: TableColumnPreference[] = [];
  const rightPinned: TableColumnPreference[] = [];

  columns.forEach((column) => {
    const pin = normalizeTableColumnPin(column.pin);
    const normalized = { ...column, pin };
    if (pin === "left") {
      leftPinned.push(normalized);
      return;
    }
    if (pin === "right") {
      rightPinned.push(normalized);
      return;
    }
    unpinned.push(normalized);
  });

  return [...leftPinned, ...unpinned, ...rightPinned];
}

export function normalizeTableColumnPreferences(
  raw: unknown,
): Partial<TableColumnPreferenceMap> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).map(([menu, value]) => [
      menu,
      Array.isArray(value)
        ? value.reduce<TableColumnPreference[]>((acc, item) => {
            const normalized = normalizeTableColumnPreferenceItem(item);
            if (normalized) {
              acc.push(normalized);
            }
            return acc;
          }, [])
        : [],
    ]),
  ) as Partial<TableColumnPreferenceMap>;
}

export function mergeTableColumnPreferences(
  defaults: TableColumnPreference[],
  saved: TableColumnPreference[] | undefined,
): TableColumnPreference[] {
  if (!saved || saved.length === 0) return lockBoundaryColumns(defaults);

  const defaultMap = new Map(defaults.map((item) => [item.id, item]));
  const ordered = saved.reduce<TableColumnPreference[]>((acc, item) => {
      const fallback = defaultMap.get(item.id);
      if (!fallback) return acc;
      const savedPin = normalizeTableColumnPin(item.pin);
      acc.push({
        ...fallback,
        visible: item.locked ? true : item.visible !== false,
        locked: fallback.locked === true,
        pin: fallback.locked ? fallback.pin ?? null : savedPin ?? fallback.pin ?? null,
      });
      return acc;
    }, []);
  const merged = [...ordered];
  const existingIds = new Set(merged.map((item) => item.id));

  defaults.forEach((item, index) => {
    if (existingIds.has(item.id)) return;

    const nextExistingDefault = defaults
      .slice(index + 1)
      .find((candidate) => existingIds.has(candidate.id));

    if (!nextExistingDefault) {
      merged.push(item);
      existingIds.add(item.id);
      return;
    }

    const insertIndex = merged.findIndex(
      (candidate) => candidate.id === nextExistingDefault.id,
    );
    if (insertIndex === -1) {
      merged.push(item);
    } else {
      merged.splice(insertIndex, 0, item);
    }
    existingIds.add(item.id);
  });

  return lockBoundaryColumns(merged);
}

export function lockBoundaryColumns(
  columns: TableColumnPreference[],
): TableColumnPreference[] {
  if (columns.length === 0) return columns;

  const first = columns.find((column) => column.id === "name") || columns[0];
  const last =
    columns.find((column) => column.id === "actions") ||
    columns[columns.length - 1];
  const middle = columns.filter(
    (column) => column.id !== first.id && column.id !== last.id,
  );

  if (first.id === last.id) {
    return [
      {
        ...first,
        locked: true,
        visible: true,
        pin: first.id === "actions" ? ("right" as const) : ("left" as const),
      },
    ];
  }

  return normalizePinnedColumnOrder([
    { ...first, locked: true, visible: true, pin: "left" as const },
    ...middle.map((column) => ({
      ...column,
      locked: column.locked === true,
      pin: column.pin === "left" ? ("left" as const) : null,
    })),
    { ...last, locked: true, visible: true, pin: "right" as const },
  ]);
}

export function updateTableColumnPreferenceMap(
  raw: unknown,
  menu: TableMenuKey,
  columns: TableColumnPreference[],
): Partial<TableColumnPreferenceMap> {
  const normalized = normalizeTableColumnPreferences(raw);
  return {
    ...normalized,
    [menu]: lockBoundaryColumns(columns),
  };
}
