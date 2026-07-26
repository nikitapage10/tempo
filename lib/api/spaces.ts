import { createClient } from "@/lib/supabase/client";
import type { Space } from "@/lib/types";
import {
  DEFAULT_SPACE_NAMES,
  DEFAULT_STAGE_NAMES,
} from "@/lib/constants";

export async function fetchSpaces(): Promise<Space[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("spaces")
    .select("*")
    .order("sort", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createSpace(name: string, sort: number): Promise<Space> {
  const supabase = createClient();
  const { data: space, error } = await supabase
    .from("spaces")
    .insert({ name, sort })
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

/** Seed Originals + Edits & Remixes with default stages when the user has none. */
export async function ensureDefaultSpaces(): Promise<Space[]> {
  const existing = await fetchSpaces();
  if (existing.length > 0) return existing;

  const created: Space[] = [];
  for (let i = 0; i < DEFAULT_SPACE_NAMES.length; i++) {
    const space = await createSpace(DEFAULT_SPACE_NAMES[i], i);
    created.push(space);
  }
  return created;
}
