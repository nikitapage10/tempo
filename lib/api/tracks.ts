import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/api/activity";
import type { Track, TrackInsert, TrackUpdate } from "@/lib/types";

export async function fetchTracks(spaceId: string): Promise<Track[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tracks")
    .select("*")
    .eq("space_id", spaceId)
    .order("list_sort", { ascending: true })
    .order("title", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(normalizeTrack);
}

export async function fetchTrack(id: string): Promise<Track> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tracks")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return normalizeTrack(data);
}

export async function fetchVersionCount(trackId: string): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("versions")
    .select("*", { count: "exact", head: true })
    .eq("track_id", trackId);
  if (error) throw error;
  return count ?? 0;
}

async function nextListSort(spaceId: string): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tracks")
    .select("list_sort")
    .eq("space_id", spaceId)
    .order("list_sort", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.list_sort ?? -1) + 1;
}

export async function createTrack(input: TrackInsert): Promise<Track> {
  const supabase = createClient();
  const listSort = await nextListSort(input.space_id);
  const { data, error } = await supabase
    .from("tracks")
    .insert({
      space_id: input.space_id,
      stage_id: input.stage_id,
      title: input.title,
      type: input.type,
      artist_alias: input.artist_alias ?? null,
      bpm: input.bpm ?? null,
      musical_key: input.musical_key ?? null,
      genre: input.genre ?? null,
      destination: input.destination ?? null,
      deadline: input.deadline || null,
      momentum: input.momentum ?? "active",
      tags: input.tags ?? [],
      notes: input.notes ?? null,
      list_sort: listSort,
    })
    .select()
    .single();
  if (error) throw error;
  return normalizeTrack(data);
}

export async function updateTrack(
  id: string,
  patch: TrackUpdate
): Promise<Track> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tracks")
    .update({
      ...patch,
      deadline: patch.deadline === "" ? null : patch.deadline,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return normalizeTrack(data);
}

export async function moveTrackStage(
  id: string,
  stageId: string | null
): Promise<Track> {
  const track = await updateTrack(id, { stage_id: stageId });
  void logStageChange(id, stageId);
  return track;
}

/** Best-effort activity log — never blocks the stage move itself. */
async function logStageChange(
  trackId: string,
  stageId: string | null
): Promise<void> {
  try {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const actorLabel = userData.user?.email ?? null;

    if (!stageId) {
      await logActivity({
        trackId,
        eventType: "stage_changed",
        summary: `${actorLabel ?? "Someone"} cleared this track’s stage`,
        entityType: "stage",
        entityId: null,
        actorLabel,
      });
      return;
    }

    const { data: stage } = await supabase
      .from("stages")
      .select("name")
      .eq("id", stageId)
      .maybeSingle();
    await logActivity({
      trackId,
      eventType: "stage_changed",
      summary: `${actorLabel ?? "Someone"} moved this to ${stage?.name ?? "a new stage"}`,
      entityType: "stage",
      entityId: stageId,
      actorLabel,
    });
  } catch {
    /* best-effort */
  }
}

export async function deleteTrack(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("tracks").delete().eq("id", id);
  if (error) throw error;
}

/** Persist Tracks-page custom order. Does not bump updated_at. */
export async function reorderTracks(
  ordered: { id: string; list_sort: number }[]
): Promise<void> {
  const supabase = createClient();
  const results = await Promise.all(
    ordered.map(({ id, list_sort }) =>
      supabase.from("tracks").update({ list_sort }).eq("id", id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

function normalizeTrack(row: Track): Track {
  return {
    ...row,
    tags: row.tags ?? [],
    bpm: row.bpm != null ? Number(row.bpm) : null,
    // Defaults for workflow fields (migration 001) so older rows / pre-migration
    // schemas don't crash the workspace — see FEATURE-SPECS.md §2.
    next_action: row.next_action ?? null,
    next_action_due: row.next_action_due ?? null,
    blocked_reason: row.blocked_reason ?? null,
    waiting_on: row.waiting_on ?? null,
    stage_entered_at: row.stage_entered_at ?? row.created_at,
    list_sort: typeof row.list_sort === "number" ? row.list_sort : 0,
  };
}
