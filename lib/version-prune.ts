import type { Version } from "@/lib/types";

/**
 * Deterministic prune set after a successful upload.
 * Keep: every pinned version + the two newest unpinned versions.
 * Never prune the current version.
 */
export function selectVersionsToPrune(
  versions: Version[],
  maxUnpinned = 2
): Version[] {
  const sorted = [...versions].sort((a, b) => b.version_no - a.version_no);
  const pinned = sorted.filter((v) => v.is_pinned);
  const unpinned = sorted.filter((v) => !v.is_pinned);
  const keepUnpinned = new Set(unpinned.slice(0, maxUnpinned).map((v) => v.id));
  const keepPinned = new Set(pinned.map((v) => v.id));

  return sorted.filter((v) => {
    if (v.is_current) return false;
    if (keepPinned.has(v.id)) return false;
    if (keepUnpinned.has(v.id)) return false;
    return true;
  });
}
