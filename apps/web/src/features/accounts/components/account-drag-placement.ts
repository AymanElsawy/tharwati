/** Placement is visual only. Persistence still receives the existing source/target IDs. */
export function insertionIndexForPointer(
  ids: readonly string[],
  sourceId: string,
  hoveredId: string,
  pointerY: number,
  hoveredTop: number,
  hoveredHeight: number
): number | null {
  const sourceIndex = ids.indexOf(sourceId)
  if (sourceIndex < 0) return null
  if (hoveredId === sourceId) return sourceIndex
  const remaining = ids.filter((id) => id !== sourceId)
  const hoveredIndex = remaining.indexOf(hoveredId)
  if (hoveredIndex < 0) return null
  return hoveredIndex + (pointerY >= hoveredTop + hoveredHeight / 2 ? 1 : 0)
}

export function insertionBeforeId(ids: readonly string[], sourceId: string, index: number): string | null {
  return ids.filter((id) => id !== sourceId)[index] ?? null
}

export function dropTargetId(ids: readonly string[], sourceId: string, index: number): string | null {
  if (index < 0 || index >= ids.length || ids[index] === sourceId) return null
  return ids[index]
}
