import { createClient } from "@/lib/supabase/client";
import {
  buildStoredArtistLayout,
  reconcileStoredArtistLayout,
} from "@/lib/artist-layout";
import type { ModuleLayout } from "@/lib/workspace-presets";

/** True when migration 027 hasn't been run yet. */
export function isMissingArtistLayoutSchema(error: { message?: string }): boolean {
  return /artist_layout_preferences/i.test(error?.message ?? "");
}

/** Null means nothing saved yet for this person on this artist. */
export async function fetchArtistLayoutPref(
  artistId: string
): Promise<ModuleLayout | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("artist_layout_preferences")
    .select("preferences")
    .eq("artist_id", artistId)
    .maybeSingle();
  if (error) {
    if (isMissingArtistLayoutSchema(error)) return null;
    throw error;
  }
  if (!data) return null;
  return reconcileStoredArtistLayout(data.preferences);
}

export async function saveArtistLayoutPref(
  artistId: string,
  layout: ModuleLayout
): Promise<ModuleLayout> {
  const supabase = createClient();
  const { error } = await supabase.from("artist_layout_preferences").upsert(
    {
      artist_id: artistId,
      preferences: buildStoredArtistLayout(layout),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,artist_id" }
  );
  if (error) throw error;
  return layout;
}

export async function clearArtistLayoutPref(artistId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("artist_layout_preferences")
    .delete()
    .eq("artist_id", artistId);
  if (error) throw error;
}
