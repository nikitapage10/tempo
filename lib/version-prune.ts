import type { Version } from "@/lib/types";

/**
 * Cloud retention — TEMPO Desktop Package 3. See
 * planning/desktop/02-TECHNICAL-AND-DATA-DESIGN.md §5.
 *
 * This used to decide which version *rows* to hard-delete (row + storage
 * object together), keeping every pinned version plus the newest two
 * unpinned ones. It now decides which version *cloud objects* to evict —
 * every row is kept forever, unconditionally, regardless of pin state.
 * Pinning still controls what's highlighted as a milestone in the timeline;
 * it no longer has any bearing on what gets deleted, because nothing
 * automatic deletes a row anymore.
 *
 * The cloud holds at most `maxCloudVersions` versions per track — the
 * current one and the one before it, by default. Anything older is a
 * candidate for eviction, but eviction only actually happens once the
 * caller confirms (via `hasConfirmedLocalCopy`) that a device has a local
 * copy of it on record — see migrations/081_desktop_vault_and_retention.sql's
 * version_local_copies table. An artist with no desktop app therefore keeps
 * every cloud object past the cap; nothing is ever silently lost.
 */

export type VersionForRetention = Pick<
  Version,
  "id" | "version_no" | "is_current" | "cloud_state"
>;

export function selectVersionsToEvict(
  versions: VersionForRetention[],
  hasConfirmedLocalCopy: (versionId: string) => boolean,
  maxCloudVersions = 2
): string[] {
  const inCloud = versions
    .filter((v) => v.cloud_state === "in_cloud")
    // Current always sorts first, so it's never evicted; the rest by
    // newest-first so "current + the one before it" falls out naturally.
    .sort((a, b) => {
      if (a.is_current !== b.is_current) return a.is_current ? -1 : 1;
      return b.version_no - a.version_no;
    });

  const keep = new Set(inCloud.slice(0, maxCloudVersions).map((v) => v.id));

  return inCloud
    .filter((v) => !keep.has(v.id))
    .filter((v) => hasConfirmedLocalCopy(v.id))
    .map((v) => v.id);
}
