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

/** A network artist as shown in the "new message" recipient picker. */
export type ProfileSearchResult = Pick<
  ArtistProfile,
  | "id"
  | "artist_id"
  | "profile_kind"
  | "handle"
  | "display_name"
  | "emblem_url"
  | "palette_id"
  | "ice_color"
  | "amber_color"
  | "tagline"
>;

/**
 * Name/handle typeahead over profiles that are on the network. RLS already
 * hides private profiles, so the visibility filter here is only about keeping
 * the query cheap.
 */
export async function searchArtistProfiles(
  query: string,
  opts: {
    excludeProfileId?: string | null;
    limit?: number;
    profileKind?: "artist" | "pro";
  } = {}
): Promise<ProfileSearchResult[]> {
  const term = query.trim().replace(/[%,()]/g, " ").trim();
  if (term.length < 2) return [];
  const supabase = createClient();
  let request = supabase
    .from("artist_profiles")
    .select("id, artist_id, profile_kind, handle, display_name, emblem_url, palette_id, ice_color, amber_color, tagline")
    .in("visibility", ["members", "public"])
    .or(`display_name.ilike.%${term}%,handle.ilike.%${term}%`)
    .order("display_name", { ascending: true })
    .limit(opts.limit ?? 8);
  if (opts.excludeProfileId) request = request.neq("id", opts.excludeProfileId);
  if (opts.profileKind) request = request.eq("profile_kind", opts.profileKind);
  const { data, error } = await request;
  if (error) {
    if (isMissingArtistProfileSchema(error)) return [];
    throw error;
  }
  return (data ?? []) as ProfileSearchResult[];
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

/**
 * Thrown when the network refuses the join because the handle is missing or
 * taken. Carries a flag so callers can reopen the handle field instead of
 * showing a dead-end toast.
 */
export class HandleRequiredError extends Error {
  readonly needsHandle = true;
}

export async function publishArtistProfile(
  artistId: string | null,
  visibility: "members" | "public",
  handle?: string
): Promise<ArtistProfile> {
  const response = await fetch("/api/network/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      artistId: artistId || undefined,
      visibility,
      handle: handle || undefined,
    }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.error ?? "Couldn’t join the network.";
    throw body?.needsHandle ? new HandleRequiredError(message) : new Error(message);
  }
  return body as ArtistProfile;
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
