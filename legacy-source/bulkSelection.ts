export function toggleSelectedId(selectedIds: readonly number[], id: number): number[] {
  return selectedIds.includes(id) ? selectedIds.filter((selectedId) => selectedId !== id) : [...selectedIds, id];
}

export function toggleSelectAll(selectedIds: readonly number[], allIds: readonly number[]): number[] {
  return selectedIds.length === allIds.length && allIds.length > 0 ? [] : [...allIds];
}

export function togglePageSelection(selectedIds: readonly number[], pageIds: readonly number[]): number[] {
  if (!pageIds.length) return [...selectedIds];
  const selected = new Set(selectedIds);
  const allPageItemsSelected = pageIds.every((id) => selected.has(id));

  if (allPageItemsSelected) {
    const pageIdSet = new Set(pageIds);
    return selectedIds.filter((id) => !pageIdSet.has(id));
  }

  return Array.from(new Set([...selectedIds, ...pageIds]));
}
