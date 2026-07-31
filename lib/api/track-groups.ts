import { createClient } from "@/lib/supabase/client";
import type { TrackGroup } from "@/lib/types";

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
  patch: { name?: string; sort?: number }
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

function normalizeGroup(row: TrackGroup): TrackGroup {
  return {
    ...row,
    name: row.name ?? "Group",
    sort: typeof row.sort === "number" ? row.sort : 0,
  };
}
