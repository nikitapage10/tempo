import { createClient } from "@/lib/supabase/client";
import {
  buildStoredArtistLayout,
  gamificationPreferenceFromStored,
  reconcileStoredArtistLayout,
  type GamificationPreference,
} from "@/lib/artist-layout";
import type { ModuleLayout } from "@/lib/workspace-presets";

/** True when migration 027 hasn't been run yet. */
export function isMissingArtistLayoutSchema(error: { message?: string }): boolean {
  return /artist_layout_preferences/i.test(error?.message ?? "");
}

export type ArtistLayoutPref = {
  layout: ModuleLayout;
  gamification: GamificationPreference;
};

/** Null means nothing saved yet for this person on this artist. */
export async function fetchArtistLayoutPref(
  artistId: string
): Promise<ArtistLayoutPref | null> {
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
  const layout = reconcileStoredArtistLayout(data.preferences);
  if (!layout) return null;
  return { layout, gamification: gamificationPreferenceFromStored(data.preferences) };
}

export async function saveArtistLayoutPref(
  artistId: string,
  layout: ModuleLayout,
  gamification: GamificationPreference
): Promise<ArtistLayoutPref> {
  const supabase = createClient();
  const { error } = await supabase.from("artist_layout_preferences").upsert(
    {
      artist_id: artistId,
      preferences: buildStoredArtistLayout(layout, gamification),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,artist_id" }
  );
  if (error) throw error;
  return { layout, gamification };
}

export async function clearArtistLayoutPref(artistId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("artist_layout_preferences")
    .delete()
    .eq("artist_id", artistId);
  if (error) throw error;
}
