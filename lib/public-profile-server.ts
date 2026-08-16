/**
 * Server-only public artist profile lookup — mirrors lib/guest-review.ts's
 * pattern: the service-role client, an explicit column list, and a fail-
 * closed check rather than an `anon` RLS policy.
 *
 * `artist_profiles` has no anon SELECT policy at all (migration 028 puts
 * `to authenticated` on every social policy) — that is deliberate. Making
 * this table the public/private boundary would mean every future column
 * added to it becomes world-readable the moment it lands, with no code
 * change to review. Routing through this module instead keeps the
 * boundary in one reviewable place.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ProfileFeaturedMusic,
  ProfileReleasedTrack,
  ProfileSoundMarker,
  ProfileStorySection,
} from "@/lib/types";

export type PublicArtistProfile = {
  profile_kind: "artist" | "pro";
  handle: string;
  display_name: string;
  emblem_url: string | null;
  banner_url: string | null;
  banner_color: string | null;
  banner_color_end: string | null;
  ice_color: string | null;
  amber_color: string | null;
  palette_id: string;
  tagline: string | null;
  bio: string | null;
  backstory: string | null;
  location: string | null;
  country_code: string | null;
  genres: string[];
  roles: string[];
  links: { label: string; url: string }[];
  sound_markers: ProfileSoundMarker[];
  current_focus_title: string | null;
  current_focus_body: string | null;
  featured_music: ProfileFeaturedMusic[];
  released_tracks: ProfileReleasedTrack[];
  story_sections: ProfileStorySection[];
  pronouns: string | null;
};

/** Null for anything not found or not `visibility = 'public'` — never distinguish the two to the caller. */
export async function resolvePublicArtistProfile(
  handle: string | undefined | null
): Promise<PublicArtistProfile | null> {
  if (!handle || !/^[a-z0-9_.]{3,30}$/.test(handle)) return null;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return null;
  }

  const { data, error } = await admin
    .from("artist_profiles")
    .select(
      "artist_id, profile_kind, handle, display_name, emblem_url, banner_url, banner_color, banner_color_end, ice_color, amber_color, palette_id, tagline, bio, backstory, location, country_code, genres, roles, links, sound_markers, current_focus_title, current_focus_body, featured_music, story_sections, pronouns, visibility"
    )
    .eq("handle", handle)
    .maybeSingle();

  if (error || !data || data.visibility !== "public") return null;

  const {
    visibility: _visibility,
    artist_id: artistId,
    ...profile
  } = data;

  // Storage paths live in the private `audio` bucket — sign them here since
  // an anonymous caller has no session to request its own signed URL.
  const signed = await Promise.all(
    [profile.emblem_url, profile.banner_url].map((path) =>
      path ? signPublicAssetPath(admin!, path) : Promise.resolve(null)
    )
  );

  const releasedTracks = data.profile_kind === "pro"
    ? []
    : await loadArtistReleasedTracks(admin, artistId);

  return {
    ...(profile as PublicArtistProfile),
    emblem_url: signed[0],
    banner_url: signed[1],
    released_tracks: releasedTracks,
  };
}

/**
 * Returns only Spotify-backed releases and never exposes private bounce or
 * version URLs. A track counts as released when it is in a Released stage or
 * has a Spotify release date that is not in the future.
 */
export async function resolveArtistReleasedTracks(
  artistId: string
): Promise<ProfileReleasedTrack[]> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }
  return loadArtistReleasedTracks(admin, artistId);
}

async function loadArtistReleasedTracks(
  admin: ReturnType<typeof createAdminClient>,
  artistId: string
): Promise<ProfileReleasedTrack[]> {
  const { data: spaces, error: spacesError } = await admin
    .from("spaces")
    .select("id")
    .eq("artist_id", artistId);
  if (spacesError || !spaces?.length) return [];

  const spaceIds = spaces.map((space) => space.id);
  const [{ data: stages }, { data: tracks, error: tracksError }] =
    await Promise.all([
      admin.from("stages").select("id, name").in("space_id", spaceIds),
      admin
        .from("tracks")
        .select(
          "id, title, artist_alias, stage_id, spotify_track_id, spotify_url, spotify_album_name, spotify_release_date"
        )
        .in("space_id", spaceIds)
        .or("spotify_track_id.not.is.null,spotify_url.not.is.null")
        .order("spotify_release_date", { ascending: false, nullsFirst: false })
        .limit(200),
    ]);
  if (tracksError || !tracks?.length) return [];

  const releasedStageIds = new Set(
    (stages ?? [])
      .filter((stage) => stage.name.trim().toLowerCase() === "released")
      .map((stage) => stage.id)
  );
  const today = new Date().toISOString().slice(0, 10);

  return tracks
    .filter(
      (track) =>
        (track.stage_id && releasedStageIds.has(track.stage_id)) ||
        (!!track.spotify_release_date && track.spotify_release_date <= today)
    )
    .slice(0, 4)
    .map(({ stage_id: _stageId, ...track }) => track as ProfileReleasedTrack);
}

async function signPublicAssetPath(
  admin: ReturnType<typeof createAdminClient>,
  path: string
): Promise<string | null> {
  if (path.startsWith("/") || path.startsWith("http://") || path.startsWith("https://")) return path;
  const { data, error } = await admin.storage
    .from("audio")
    .createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
