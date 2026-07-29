import { createClient } from "@/lib/supabase/client";
import type { TrackListPreset } from "@/lib/types";

function mapPresetError(error: { message?: string; code?: string }): Error {
  const message = (error.message ?? "").trim();
  const lower = message.toLowerCase();
  // Table missing / not exposed — migration 018 not run (or schema cache stale).
  if (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    lower.includes("track_list_presets") ||
    lower.includes("schema cache") ||
    (lower.includes("relation") && lower.includes("does not exist"))
  ) {
    return new Error(
      "Saved orders need migration 018 in Supabase — run that SQL, then try again."
    );
  }
  if (lower.includes("jwt") || lower.includes("auth") || error.code === "401") {
    return new Error("You’re signed out — sign in again, then try saving.");
  }
  return new Error(message || "Couldn’t save that order.");
}

export async function fetchTrackListPresets(
  spaceId: string
): Promise<TrackListPreset[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("track_list_presets")
    .select("*")
    .eq("space_id", spaceId)
    .order("created_at", { ascending: true });
  if (error) {
    // Missing table shouldn't blank the Tracks page — treat as no presets yet.
    const mapped = mapPresetError(error);
    if (mapped.message.includes("migration 018")) return [];
    throw mapped;
  }
  return (data ?? []).map(normalizePreset);
}

export async function createTrackListPreset(input: {
  spaceId: string;
  name: string;
  trackIds: string[];
}): Promise<TrackListPreset> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You’re signed out — sign in again.");

  const name = input.name.trim();
  if (!name) throw new Error("Give this order a name.");

  const { data, error } = await supabase
    .from("track_list_presets")
    .insert({
      user_id: user.id,
      space_id: input.spaceId,
      name,
      track_ids: input.trackIds,
    })
    .select()
    .single();
  if (error) throw mapPresetError(error);
  return normalizePreset(data);
}

export async function updateTrackListPreset(
  id: string,
  patch: { name?: string; trackIds?: string[] }
): Promise<TrackListPreset> {
  const supabase = createClient();
  const body: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.name != null) body.name = patch.name.trim();
  if (patch.trackIds != null) body.track_ids = patch.trackIds;

  const { data, error } = await supabase
    .from("track_list_presets")
    .update(body)
    .eq("id", id)
    .select()
    .single();
  if (error) throw mapPresetError(error);
  return normalizePreset(data);
}

export async function deleteTrackListPreset(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("track_list_presets")
    .delete()
    .eq("id", id);
  if (error) throw mapPresetError(error);
}

function normalizePreset(row: TrackListPreset): TrackListPreset {
  return {
    ...row,
    track_ids: row.track_ids ?? [],
    name: row.name ?? "Saved order",
  };
}
