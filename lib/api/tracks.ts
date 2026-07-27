import { createClient } from "@/lib/supabase/client";
import type { Track, TrackInsert, TrackUpdate } from "@/lib/types";

export async function fetchTracks(spaceId: string): Promise<Track[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tracks")
    .select("*")
    .eq("space_id", spaceId)
    .order("updated_at", { ascending: false });
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

export async function createTrack(input: TrackInsert): Promise<Track> {
  const supabase = createClient();
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
  stageId: string
): Promise<Track> {
  return updateTrack(id, { stage_id: stageId });
}

export async function deleteTrack(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("tracks").delete().eq("id", id);
  if (error) throw error;
}

function normalizeTrack(row: Track): Track {
  return {
    ...row,
    tags: row.tags ?? [],
    bpm: row.bpm != null ? Number(row.bpm) : null,
  };
}
