export type Top8Candidate = {
  id: string;
  name: string;
  handle: string | null;
  emblemUrl: string | null;
  paletteId: string | null;
  iceColor: string | null;
  amberColor: string | null;
};

export const TOP8_SLOTS = 8;

export type Top8Slots = {
  /** Saved picks we can draw, in saved order. */
  picked: Top8Candidate[];
  /** Saved ids we can't draw — deleted, private, or no longer followed. */
  unavailable: string[];
  /** Slots left to fill. Counts unavailable picks, because they still occupy one. */
  emptyCount: number;
};

/**
 * Splits saved picks against who's actually pickable. An unresolved id still
 * holds a slot, so it has to be surfaced rather than skipped — otherwise the
 * grid offers an empty slot the eight-pick limit will refuse to fill.
 */
export function partitionTop8(
  top8: string[],
  candidates: Top8Candidate[],
  { candidatesReady = true }: { candidatesReady?: boolean } = {}
): Top8Slots {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const picked: Top8Candidate[] = [];
  const unavailable: string[] = [];
  for (const id of top8) {
    const candidate = byId.get(id);
    if (candidate) picked.push(candidate);
    else if (candidatesReady) unavailable.push(id);
  }
  return {
    picked,
    unavailable,
    emptyCount: Math.max(0, TOP8_SLOTS - top8.length),
  };
}

export function filterTop8Candidates(
  candidates: Top8Candidate[],
  query: string
): Top8Candidate[] {
  const q = query.trim().toLowerCase();
  if (!q) return candidates;
  return candidates.filter((c) => {
    if (c.name.toLowerCase().includes(q)) return true;
    const handle = c.handle?.toLowerCase() ?? "";
    if (!handle) return false;
    return handle.includes(q) || `@${handle}`.includes(q);
  });
}
