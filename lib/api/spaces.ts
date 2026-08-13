import { createClient } from "@/lib/supabase/client";
import type { Space, SpaceFocus } from "@/lib/types";
import {
  DEFAULT_SPACE_NAMES,
  DEFAULT_STAGE_NAMES,
} from "@/lib/constants";

/** Omit `artistId` only where a cross-artist list is genuinely wanted. */
export async function fetchSpaces(artistId?: string): Promise<Space[]> {
  const supabase = createClient();
  let query = supabase.from("spaces").select("*");
  if (artistId) query = query.eq("artist_id", artistId);
  const { data, error } = await query.order("sort", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createSpace(
  name: string,
  sort: number,
  artistId: string,
  focus: SpaceFocus = "music"
): Promise<Space> {
  const supabase = createClient();
  const { data: space, error } = await supabase
    .from("spaces")
    .insert({ name, sort, focus, artist_id: artistId })
    .select()
    .single();
  if (error) throw error;

  const stages = DEFAULT_STAGE_NAMES.map((stageName, i) => ({
    space_id: space.id,
    name: stageName,
    sort: i,
  }));
  const { error: stageError } = await supabase.from("stages").insert(stages);
  if (stageError) throw stageError;

  return space;
}

export async function renameSpace(id: string, name: string): Promise<Space> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("spaces")
    .update({ name })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSpaceFocus(
  id: string,
  focus: SpaceFocus
): Promise<Space> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("spaces")
    .update({ focus })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSpace(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("spaces").delete().eq("id", id);
  if (error) throw error;
}

export async function reorderSpaces(
  ordered: { id: string; sort: number }[]
): Promise<void> {
  const supabase = createClient();
  const results = await Promise.all(
    ordered.map(({ id, sort }) =>
      supabase.from("spaces").update({ sort }).eq("id", id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

/** Seed default spaces when this artist has none. Personal workspaces get a single tasks-focused Home space instead of music catalog spaces. */
export async function ensureDefaultSpaces(
  artistId: string,
  kind: "artist" | "personal" = "artist"
): Promise<Space[]> {
  const existing = await fetchSpaces(artistId);
  if (existing.length > 0) {
    if (kind === "personal") {
      const leftover = existing.find((space) => space.name === "Work");
      if (leftover) {
        await renameSpace(leftover.id, "Home");
        return fetchSpaces(artistId);
      }
    }
    return existing;
  }

  if (kind === "personal") {
    return [await createSpace("Home", 0, artistId, "tasks")];
  }

  const created: Space[] = [];
  for (let i = 0; i < DEFAULT_SPACE_NAMES.length; i++) {
    const space = await createSpace(DEFAULT_SPACE_NAMES[i], i, artistId);
    created.push(space);
  }
  return created;
}
