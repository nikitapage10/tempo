import { createClient } from "@/lib/supabase/client";
import type { ArtistProfile, ArtistProfileUpdate } from "@/lib/types";

/** True when migration 028 hasn't been run yet. */
export function isMissingArtistProfileSchema(error: { message?: string }): boolean {
  return /artist_profiles/i.test(error?.message ?? "");
}

/** Null means this artist has no profile row yet — treat as an unpublished default. */
export async function fetchArtistProfile(
  artistId: string
): Promise<ArtistProfile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("artist_profiles")
    .select("*")
    .eq("artist_id", artistId)
    .maybeSingle();
  if (error) {
    if (isMissingArtistProfileSchema(error)) return null;
    throw error;
  }
  return (data as ArtistProfile) ?? null;
}

/** Public/members-visible profile lookup by handle — used for /artist/[handle]. */
export async function fetchArtistProfileByHandle(
  handle: string
): Promise<ArtistProfile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("artist_profiles")
    .select("*")
    .eq("handle", handle.toLowerCase())
    .maybeSingle();
  if (error) {
    if (isMissingArtistProfileSchema(error)) return null;
    throw error;
  }
  return (data as ArtistProfile) ?? null;
}

/**
 * Creates the profile row on first edit (a fresh artist has none yet), or
 * updates the existing one. Never touches `visibility`/`published_at` —
 * that's `publishProfile`/`unpublishProfile` below, so "save" and "go
 * public" stay two distinct, deliberate actions.
 */
export async function upsertArtistProfile(
  artistId: string,
  patch: ArtistProfileUpdate,
  displayName: string
): Promise<ArtistProfile> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("artist_profiles")
    .upsert(
      { artist_id: artistId, display_name: displayName, ...patch },
      { onConflict: "artist_id" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as ArtistProfile;
}

export async function publishArtistProfile(
  artistId: string,
  visibility: "members" | "public"
): Promise<ArtistProfile> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("artist_profiles")
    .update({ visibility, published_at: new Date().toISOString() })
    .eq("artist_id", artistId)
    .select("*")
    .single();
  if (error) throw error;
  return data as ArtistProfile;
}

export async function unpublishArtistProfile(artistId: string): Promise<ArtistProfile> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("artist_profiles")
    .update({ visibility: "private" })
    .eq("artist_id", artistId)
    .select("*")
    .single();
  if (error) throw error;
  return data as ArtistProfile;
}

/** True when the handle is free (or already yours). Case-insensitive. */
export async function checkHandleAvailable(
  handle: string,
  currentArtistId?: string
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("artist_profiles")
    .select("artist_id")
    .eq("handle", handle.toLowerCase())
    .maybeSingle();
  if (error) {
    if (isMissingArtistProfileSchema(error)) return true;
    throw error;
  }
  if (!data) return true;
  return currentArtistId ? data.artist_id === currentArtistId : false;
}
