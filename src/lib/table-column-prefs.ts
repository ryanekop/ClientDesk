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

export function isBoundaryTableColumnId(columnId: string) {
  return columnId === "name" || columnId === "actions";
}

export function isAlwaysVisibleTableColumnId(columnId: string) {
  return isBoundaryTableColumnId(columnId);
}

export function canToggleTableColumnPin(column: TableColumnPreference) {
  return column.locked !== true;
}

export function canToggleTableColumnVisibility(column: TableColumnPreference) {
  return !isAlwaysVisibleTableColumnId(column.id);
}

export function canReorderTableColumn(column: TableColumnPreference) {
  return column.locked !== true && !isBoundaryTableColumnId(column.id);
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
        visible: isAlwaysVisibleTableColumnId(fallback.id)
          ? true
          : item.visible !== false,
        locked: fallback.locked === true,
        pin: fallback.locked ? fallback.pin ?? null : savedPin,
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

  const leadingFixed = columns.find((column) => column.id === "row_number");
  const first =
    columns.find((column) => column.id === "name") ||
    columns.find((column) => column.id !== "row_number") ||
    columns[0];
  const last =
    columns.find((column) => column.id === "actions") ||
    columns[columns.length - 1];
  const middle = columns.filter((column) => {
    if (column.id === first.id || column.id === last.id) return false;
    if (leadingFixed && column.id === leadingFixed.id) return false;
    return true;
  });

  const normalizedMiddle = normalizePinnedColumnOrder(
    middle.map((column) => ({
      ...column,
      locked: column.locked === true,
      pin: column.pin === "left" ? ("left" as const) : null,
    })),
  );
  const result: TableColumnPreference[] = [];

  if (leadingFixed) {
    result.push({
      ...leadingFixed,
      locked: leadingFixed.locked === true,
      visible: leadingFixed.visible !== false,
      pin: null,
    });
  }

  if (!leadingFixed || leadingFixed.id !== first.id) {
    result.push({
      ...first,
      locked: false,
      visible: true,
      pin: first.pin === "left" ? ("left" as const) : null,
    });
  }

  result.push(...normalizedMiddle);

  if (
    (!leadingFixed || leadingFixed.id !== last.id) &&
    first.id !== last.id
  ) {
    result.push({
      ...last,
      locked: false,
      visible: true,
      pin: last.pin === "right" ? ("right" as const) : null,
    });
  }

  return result;
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
