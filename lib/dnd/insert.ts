/** Place `id` in front of `beforeId`, or at the end when `beforeId` is null. */
export function insertIdBefore(
  ids: string[],
  id: string,
  beforeId: string | null
): string[] {
  const next = ids.filter((item) => item !== id);
  if (!beforeId || beforeId === id) return [...next, id];
  const index = next.indexOf(beforeId);
  if (index < 0) return [...next, id];
  next.splice(index, 0, id);
  return next;
}

/** Even ranks so a later insert can land in the gap. */
export function ranksForIds(ids: string[], gap = 100): { id: string; sort: number }[] {
  return ids.map((id, index) => ({ id, sort: (index + 1) * gap }));
}

export function isNoOpInsert(
  ids: string[],
  id: string,
  beforeId: string | null
): boolean {
  const current = ids.filter((item) => item !== id);
  const from = ids.indexOf(id);
  if (from < 0) return false;
  const after = ids[from + 1] ?? null;
  if (beforeId === id) return true;
  if (beforeId == null) return after == null;
  return after === beforeId;
}
