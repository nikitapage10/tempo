import { createClient } from "@/lib/supabase/client";
import type { ReleaseDetails, ReleaseTrackMetadata } from "@/lib/types";

function normalizeMetadata(row: ReleaseTrackMetadata): ReleaseTrackMetadata {
  return {
    ...row,
    featured_artists: row.featured_artists ?? [],
    writers: row.writers ?? [],
    producers: row.producers ?? [],
  };
}

export async function fetchReleaseDetails(
  projectId: string
): Promise<ReleaseDetails | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("release_details")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type UpsertReleaseDetailsInput = Partial<
  Omit<ReleaseDetails, "project_id" | "created_at" | "updated_at">
>;

export async function upsertReleaseDetails(
  projectId: string,
  patch: UpsertReleaseDetailsInput
): Promise<ReleaseDetails> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("release_details")
    .upsert(
      {
        project_id: projectId,
        ...patch,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchReleaseTrackMetadata(
  projectId: string
): Promise<ReleaseTrackMetadata[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("release_track_metadata")
    .select("*")
    .eq("project_id", projectId)
    .order("track_number", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map(normalizeMetadata);
}

export async function fetchReleaseTrackMetadataForTrack(
  projectId: string,
  trackId: string
): Promise<ReleaseTrackMetadata | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("release_track_metadata")
    .select("*")
    .eq("project_id", projectId)
    .eq("track_id", trackId)
    .maybeSingle();
  if (error) throw error;
  return data ? normalizeMetadata(data) : null;
}

export type UpsertReleaseTrackMetadataInput = Partial<
  Omit<ReleaseTrackMetadata, "id" | "project_id" | "track_id">
>;

/** project_id + track_id is a real (non-partial) unique constraint, so ON CONFLICT upsert is safe here. */
export async function upsertReleaseTrackMetadata(
  projectId: string,
  trackId: string,
  patch: UpsertReleaseTrackMetadataInput
): Promise<ReleaseTrackMetadata> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("release_track_metadata")
    .upsert(
      {
        project_id: projectId,
        track_id: trackId,
        ...patch,
      },
      { onConflict: "project_id,track_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return normalizeMetadata(data);
}

export async function deleteReleaseTrackMetadata(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("release_track_metadata")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
