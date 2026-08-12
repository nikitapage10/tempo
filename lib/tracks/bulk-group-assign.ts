/**
 * Build a full custom-order payload that moves `selectedIds` into
 * `targetGroupId` (or ungrouped when null), keeping relative order of
 * everything else. Used by Tracks multi-select "Move to group".
 */

export type GroupKey = string | null;

export type BulkGroupTrack = {
  id: string;
  list_group_id: string | null;
};

export type BulkReorderRow = {
  id: string;
  list_sort: number;
  list_group_id: string | null;
};

function trackGroupKey(
  track: BulkGroupTrack,
  knownGroupIds: Set<string>
): GroupKey {
  if (track.list_group_id && knownGroupIds.has(track.list_group_id)) {
    return track.list_group_id;
  }
  return null;
}

export function assignTracksToGroupOrder(input: {
  /** Tracks in current Custom list order. */
  orderedTracks: BulkGroupTrack[];
  /** Existing group ids in display order. */
  groupIds: string[];
  selectedIds: string[];
  targetGroupId: GroupKey;
}): BulkReorderRow[] {
  const { orderedTracks, selectedIds, targetGroupId } = input;
  const selected = new Set(selectedIds);
  const known = new Set(input.groupIds);

  const groupKeys: GroupKey[] = [...input.groupIds, null];
  if (
    typeof targetGroupId === "string" &&
    targetGroupId.length > 0 &&
    !groupKeys.includes(targetGroupId)
  ) {
    // Brand-new group not yet in the cached list — park it above ungrouped.
    groupKeys.splice(groupKeys.length - 1, 0, targetGroupId);
    known.add(targetGroupId);
  }

  const buckets = new Map<GroupKey, string[]>();
  for (const k of groupKeys) buckets.set(k, []);

  const moving: string[] = [];
  for (const track of orderedTracks) {
    if (selected.has(track.id)) {
      moving.push(track.id);
      continue;
    }
    const key = trackGroupKey(track, known);
    buckets.get(key)!.push(track.id);
  }

  if (!buckets.has(targetGroupId)) buckets.set(targetGroupId, []);
  buckets.get(targetGroupId)!.push(...moving);

  const flattened: BulkReorderRow[] = [];
  let i = 0;
  for (const k of groupKeys) {
    for (const id of buckets.get(k) ?? []) {
      flattened.push({ id, list_sort: i++, list_group_id: k });
    }
  }
  return flattened;
}
