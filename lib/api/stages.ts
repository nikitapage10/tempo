import { createClient } from "@/lib/supabase/client";
import type { Stage } from "@/lib/types";

export async function fetchStages(spaceId: string): Promise<Stage[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("stages")
    .select("*")
    .eq("space_id", spaceId)
    .order("sort", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createStage(
  spaceId: string,
  name: string,
  sort: number
): Promise<Stage> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("stages")
    .insert({ space_id: spaceId, name, sort })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function renameStage(id: string, name: string): Promise<Stage> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("stages")
    .update({ name })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function reorderStages(
  ordered: { id: string; sort: number }[]
): Promise<void> {
  const supabase = createClient();
  const results = await Promise.all(
    ordered.map(({ id, sort }) =>
      supabase.from("stages").update({ sort }).eq("id", id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

/** Move tracks off a stage, then delete it. */
export async function deleteStage(
  stageId: string,
  moveTracksToStageId: string | null
): Promise<void> {
  const supabase = createClient();

  if (moveTracksToStageId) {
    const { error: moveError } = await supabase
      .from("tracks")
      .update({ stage_id: moveTracksToStageId, updated_at: new Date().toISOString() })
      .eq("stage_id", stageId);
    if (moveError) throw moveError;
  } else {
    const { error: clearError } = await supabase
      .from("tracks")
      .update({ stage_id: null, updated_at: new Date().toISOString() })
      .eq("stage_id", stageId);
    if (clearError) throw clearError;
  }

  const { error } = await supabase.from("stages").delete().eq("id", stageId);
  if (error) throw error;
}

export async function countTracksInStage(stageId: string): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("tracks")
    .select("*", { count: "exact", head: true })
    .eq("stage_id", stageId);
  if (error) throw error;
  return count ?? 0;
}
