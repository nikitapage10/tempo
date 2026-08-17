/**
 * Resolves a name the parser returned (AI or regex fallback) against an
 * already-loaded list of {id, name} candidates. Case-insensitive contains
 * match; the model is told to only return names that exist in the list it
 * was given, but this re-checks locally so a hallucinated or fallback-parsed
 * name can never silently resolve to the wrong record.
 */
export function resolveNameToId(
  name: string | null,
  candidates: Array<{ id: string; name: string }>
): string | null {
  if (!name) return null;
  const needle = name.trim().toLowerCase();
  if (!needle) return null;

  const exact = candidates.find((c) => c.name.trim().toLowerCase() === needle);
  if (exact) return exact.id;

  const matches = candidates.filter((c) => c.name.trim().toLowerCase().includes(needle));
  if (matches.length === 1) return matches[0].id;

  // Ambiguous or no match — leave unresolved rather than guessing.
  return null;
}
