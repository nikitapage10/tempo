import { createClient } from "@/lib/supabase/client";
import { deleteFile, sanitizeFilename, uploadFile } from "@/lib/storage";
import type { TrackGroup, TrackGroupAccent } from "@/lib/types";

/** The tints a group can be given. Fixed, so they stay in the Spectra family. */
export const TRACK_GROUP_ACCENTS: {
  value: TrackGroupAccent;
  label: string;
}[] = [
  { value: "ice", label: "Ice" },
  { value: "amber", label: "Amber" },
  { value: "violet", label: "Violet" },
  { value: "ok", label: "Green" },
  { value: "warn", label: "Coral" },
];

function mapGroupError(error: { message?: string; code?: string }): Error {
  const message = (error.message ?? "").trim();
  const lower = message.toLowerCase();
  if (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    lower.includes("track_groups") ||
    lower.includes("list_group_id") ||
    lower.includes("schema cache") ||
    (lower.includes("relation") && lower.includes("does not exist"))
  ) {
    return new Error(
      "Track groups need migration 041 in Supabase — run that SQL, then try again."
    );
  }
  if (lower.includes("cover_url") || lower.includes("accent_color") || lower.includes("ungrouped_sort")) {
    return new Error(
      "Group covers and colours need migration 044 in Supabase — run that SQL, then try again."
    );
  }
  if (lower.includes("jwt") || lower.includes("auth") || error.code === "401") {
    return new Error("You’re signed out — sign in again, then try again.");
  }
  return new Error(message || "Couldn’t update that group.");
}

export async function fetchTrackGroups(spaceId: string): Promise<TrackGroup[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("track_groups")
    .select("*")
    .eq("space_id", spaceId)
    .order("sort", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    const mapped = mapGroupError(error);
    if (mapped.message.includes("migration 041")) return [];
    throw mapped;
  }
  return (data ?? []).map(normalizeGroup);
}

async function nextGroupSort(spaceId: string): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("track_groups")
    .select("sort")
    .eq("space_id", spaceId)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw mapGroupError(error);
  return (data?.sort ?? -1) + 1;
}

export async function createTrackGroup(input: {
  spaceId: string;
  name: string;
}): Promise<TrackGroup> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You’re signed out — sign in again.");

  const name = input.name.trim();
  if (!name) throw new Error("Give this group a name.");

  const sort = await nextGroupSort(input.spaceId);
  const { data, error } = await supabase
    .from("track_groups")
    .insert({
      user_id: user.id,
      space_id: input.spaceId,
      name,
      sort,
    })
    .select()
    .single();
  if (error) throw mapGroupError(error);
  return normalizeGroup(data);
}

export async function updateTrackGroup(
  id: string,
  patch: {
    name?: string;
    sort?: number;
    /** `null` clears the tint back to the plain surface. */
    accentColor?: TrackGroupAccent | null;
    /** `null` clears the cover. The stored object is removed separately. */
    coverUrl?: string | null;
  }
): Promise<TrackGroup> {
  const supabase = createClient();
  const body: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.name != null) {
    const name = patch.name.trim();
    if (!name) throw new Error("Give this group a name.");
    body.name = name;
  }
  if (patch.sort != null) body.sort = patch.sort;
  // `undefined` means "leave alone"; `null` means "clear".
  if (patch.accentColor !== undefined) body.accent_color = patch.accentColor;
  if (patch.coverUrl !== undefined) body.cover_url = patch.coverUrl;

  const { data, error } = await supabase
    .from("track_groups")
    .update(body)
    .eq("id", id)
    .select()
    .single();
  if (error) throw mapGroupError(error);
  return normalizeGroup(data);
}

export async function reorderTrackGroups(
  ordered: { id: string; sort: number }[]
): Promise<void> {
  const supabase = createClient();
  const results = await Promise.all(
    ordered.map(({ id, sort }) =>
      supabase
        .from("track_groups")
        .update({ sort, updated_at: new Date().toISOString() })
        .eq("id", id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw mapGroupError(failed.error);
}

export async function deleteTrackGroup(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("track_groups").delete().eq("id", id);
  if (error) throw mapGroupError(error);
}

/** Group cover art. Same private bucket as everything else, own prefix. */
export function buildTrackGroupCoverPath(params: {
  groupId: string;
  filename: string;
}): string {
  return `track-groups/${params.groupId}/cover/${sanitizeFilename(params.filename)}`;
}

const MAX_COVER_BYTES = 8 * 1024 * 1024;

/**
 * Replace a group's cover.
 *
 * The row is pointed at the new object before the old one is removed, so a
 * failed delete leaves an orphaned file rather than a group whose cover is a
 * broken link.
 */
export async function uploadTrackGroupCover(
  group: TrackGroup,
  file: File
): Promise<TrackGroup> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Cover art needs to be an image.");
  }
  if (file.size > MAX_COVER_BYTES) {
    throw new Error("That image is over 8MB — try a smaller one.");
  }
  const path = buildTrackGroupCoverPath({
    groupId: group.id,
    // Fresh name per upload: the bucket rejects overwrites, and a stable name
    // would also be served stale from the signed-URL cache.
    filename: `${Date.now()}-${file.name}`,
  });
  await uploadFile(path, file);
  const updated = await updateTrackGroup(group.id, { coverUrl: path });
  if (group.cover_url && group.cover_url !== path) {
    void deleteFile(group.cover_url).catch(() => {});
  }
  return updated;
}

export async function clearTrackGroupCover(group: TrackGroup): Promise<TrackGroup> {
  const updated = await updateTrackGroup(group.id, { coverUrl: null });
  if (group.cover_url) void deleteFile(group.cover_url).catch(() => {});
  return updated;
}

/**
 * Move the ungrouped run among the groups.
 *
 * It has no row of its own, so its position lives on the space. Everything is
 * renumbered together by the caller, which keeps one ordered list rather than
 * two that can drift apart.
 */
export async function setUngroupedSort(
  spaceId: string,
  sort: number
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("spaces")
    .update({ ungrouped_sort: sort })
    .eq("id", spaceId);
  if (error) throw mapGroupError(error);
}

function normalizeGroup(row: TrackGroup): TrackGroup {
  return {
    ...row,
    name: row.name ?? "Group",
    sort: typeof row.sort === "number" ? row.sort : 0,
    cover_url: row.cover_url ?? null,
    accent_color: row.accent_color ?? null,
  };
}
