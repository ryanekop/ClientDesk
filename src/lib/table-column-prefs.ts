export type TableMenuKey = "bookings" | "client_status" | "finance" | "team";

export type TableColumnPreference = {
  id: string;
  label: string;
  visible: boolean;
  locked?: boolean;
};

export type TableColumnPreferenceMap = Record<TableMenuKey, TableColumnPreference[]>;

export function normalizeTableColumnPreferences(
  raw: unknown,
): Partial<TableColumnPreferenceMap> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).map(([menu, value]) => [
      menu,
      Array.isArray(value)
        ? value
            .filter((item): item is TableColumnPreference => {
              return (
                !!item &&
                typeof item === "object" &&
                "id" in item &&
                "label" in item &&
                typeof item.id === "string" &&
                typeof item.label === "string"
              );
            })
            .map((item) => ({
              id: item.id,
              label: item.label,
              visible: item.visible !== false,
              locked: item.locked === true,
            }))
        : [],
    ]),
  ) as Partial<TableColumnPreferenceMap>;
}

export function mergeTableColumnPreferences(
  defaults: TableColumnPreference[],
  saved: TableColumnPreference[] | undefined,
): TableColumnPreference[] {
  if (!saved || saved.length === 0) return defaults;

  const defaultMap = new Map(defaults.map((item) => [item.id, item]));
  const ordered = saved
    .map((item) => {
      const fallback = defaultMap.get(item.id);
      if (!fallback) return null;
      return {
        ...fallback,
        visible: item.locked ? true : item.visible !== false,
        locked: fallback.locked === true,
      };
    })
    .filter((item): item is TableColumnPreference => item !== null);

  const missing = defaults.filter(
    (item) => !ordered.some((savedItem) => savedItem.id === item.id),
  );

  const merged = [...ordered, ...missing];
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

  return [
    { ...first, locked: true, visible: true },
    ...middle.map((column) => ({ ...column, locked: column.locked === true })),
    { ...last, locked: true, visible: true },
  ];
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
