import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/api/activity";
import { normalizeTrackType } from "@/lib/track-style";
import { recordProductEvent } from "@/lib/product-events/client";
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
  // Dedupe key is per-user, not per-track — the unique (user_id, dedupe_key)
  // constraint naturally collapses this to "first track only" without an
  // extra query. Every later track creation still fires the request but
  // lands as an expected, harmless duplicate.
  recordProductEvent(
    "first_track_created",
    { creation_path: "manual" },
    { spaceId: input.space_id, dedupeKey: "first_track_created:v1" }
  );
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

/** Persist Tracks-page custom order and optional group membership. Does not bump updated_at. */
export async function reorderTracks(
  ordered: {
    id: string;
    list_sort: number;
    list_group_id?: string | null;
  }[]
): Promise<void> {
  const supabase = createClient();
  const results = await Promise.all(
    ordered.map(({ id, list_sort, list_group_id }) => {
      const patch: { list_sort: number; list_group_id?: string | null } = {
        list_sort,
      };
      if (list_group_id !== undefined) patch.list_group_id = list_group_id;
      return supabase.from("tracks").update(patch).eq("id", id);
    })
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    const message = (failed.error.message ?? "").toLowerCase();
    if (
      failed.error.code === "PGRST204" ||
      message.includes("list_group_id")
    ) {
      throw new Error(
        "Track groups need migration 041 in Supabase — run that SQL, then try again."
      );
    }
    throw failed.error;
  }
}

function normalizeTrack(row: Track): Track {
  return {
    ...row,
    type: normalizeTrackType(row.type),
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
    list_group_id: row.list_group_id ?? null,
    spotify_track_id: row.spotify_track_id ?? null,
    spotify_url: row.spotify_url ?? null,
    spotify_album_id: row.spotify_album_id ?? null,
    spotify_album_name: row.spotify_album_name ?? null,
    spotify_album_url: row.spotify_album_url ?? null,
    spotify_release_date: row.spotify_release_date ?? null,
    spotify_release_date_precision: row.spotify_release_date_precision ?? null,
    spotify_isrc: row.spotify_isrc ?? null,
    spotify_duration_ms:
      typeof row.spotify_duration_ms === "number" ? row.spotify_duration_ms : null,
    spotify_explicit:
      typeof row.spotify_explicit === "boolean" ? row.spotify_explicit : null,
    spotify_track_number:
      typeof row.spotify_track_number === "number" ? row.spotify_track_number : null,
    spotify_disc_number:
      typeof row.spotify_disc_number === "number" ? row.spotify_disc_number : null,
    spotify_artist_names: row.spotify_artist_names ?? [],
    spotify_synced_at: row.spotify_synced_at ?? null,
  };
}
