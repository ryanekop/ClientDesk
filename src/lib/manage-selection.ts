export type BulkActionKind = "archive" | "restore" | "delete";

export function toggleSelection(selectedIds: string[], id: string) {
  return selectedIds.includes(id)
    ? selectedIds.filter((item) => item !== id)
    : [...selectedIds, id];
}

export function pruneSelection(selectedIds: string[], visibleIds: string[]) {
  if (selectedIds.length === 0) return selectedIds;
  const visibleIdSet = new Set(visibleIds);
  return selectedIds.filter((id) => visibleIdSet.has(id));
}

export function areAllVisibleSelected(
  selectedIds: string[],
  visibleIds: string[],
) {
  if (visibleIds.length === 0) return false;
  const selectedIdSet = new Set(selectedIds);
  return visibleIds.every((id) => selectedIdSet.has(id));
}

export function toggleSelectAllVisible(
  selectedIds: string[],
  visibleIds: string[],
) {
  if (visibleIds.length === 0) return selectedIds;
  return areAllVisibleSelected(selectedIds, visibleIds) ? [] : [...visibleIds];
}
