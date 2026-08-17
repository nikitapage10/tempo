export type Top8Candidate = {
  id: string;
  name: string;
  handle: string | null;
  emblemUrl: string | null;
  paletteId: string | null;
  iceColor: string | null;
  amberColor: string | null;
};

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
