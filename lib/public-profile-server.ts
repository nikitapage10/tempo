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

export type PublicArtistProfile = {
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
      "handle, display_name, emblem_url, banner_url, banner_color, banner_color_end, ice_color, amber_color, palette_id, tagline, bio, backstory, location, country_code, genres, roles, links, pronouns, visibility"
    )
    .eq("handle", handle)
    .maybeSingle();

  if (error || !data || data.visibility !== "public") return null;

  const { visibility: _visibility, ...profile } = data;

  // Storage paths live in the private `audio` bucket — sign them here since
  // an anonymous caller has no session to request its own signed URL.
  const signed = await Promise.all(
    [profile.emblem_url, profile.banner_url].map((path) =>
      path ? signPublicAssetPath(admin!, path) : Promise.resolve(null)
    )
  );

  return {
    ...(profile as PublicArtistProfile),
    emblem_url: signed[0],
    banner_url: signed[1],
  };
}

async function signPublicAssetPath(
  admin: ReturnType<typeof createAdminClient>,
  path: string
): Promise<string | null> {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const { data, error } = await admin.storage
    .from("audio")
    .createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
