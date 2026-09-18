import { createClient } from "@/lib/supabase/client";
import type { ArtistProfile, ProfileFollow } from "@/lib/types";

type ProfileCard = Pick<
  ArtistProfile,
  | "id"
  | "handle"
  | "display_name"
  | "emblem_url"
  | "palette_id"
  | "ice_color"
  | "amber_color"
  | "tagline"
  | "visibility"
  | "location"
  | "country_code"
>;

type FollowRow = ProfileFollow & { profile: ProfileCard | null };

function asCard(profileRaw: unknown): ProfileCard | null {
  const profile = (Array.isArray(profileRaw) ? profileRaw[0] : profileRaw) as ProfileCard | null;
  if (!profile?.id) return null;
  if (!profile.display_name?.trim() && !profile.handle) return null;
  return profile;
}

/** Fill in private/own profiles the embed left blank (e.g. demo artist). */
async function hydrateMissingProfiles(
  rows: FollowRow[],
  idKey: "followee_profile_id" | "follower_profile_id"
) {
  const missing = rows.filter((row) => !row.profile).map((row) => row[idKey]);
  if (!missing.length) return rows;

  const res = await fetch("/api/social/profile-cards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: missing }),
  });
  if (!res.ok) return rows;
  const body = await res.json().catch(() => null);
  const byId = new Map<string, ProfileCard>();
  for (const card of body?.profiles ?? []) {
    if (card?.id) byId.set(card.id, card as ProfileCard);
  }
  return rows.map((row) =>
    row.profile ? row : { ...row, profile: byId.get(row[idKey]) ?? null }
  );
}

export async function followProfile(
  followerProfileId: string,
  followeeProfileId: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("profile_follows").insert({
    follower_profile_id: followerProfileId,
    followee_profile_id: followeeProfileId,
  });
  if (error) throw error;
}

export async function unfollowProfile(
  followerProfileId: string,
  followeeProfileId: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("profile_follows")
    .delete()
    .eq("follower_profile_id", followerProfileId)
    .eq("followee_profile_id", followeeProfileId);
  if (error) throw error;
}

export async function isFollowingProfile(
  followerProfileId: string,
  followeeProfileId: string
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profile_follows")
    .select("follower_profile_id")
    .eq("follower_profile_id", followerProfileId)
    .eq("followee_profile_id", followeeProfileId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function fetchFollowing(profileId: string): Promise<FollowRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profile_follows")
    .select(
      `
      follower_profile_id, followee_profile_id, created_at,
      profile:artist_profiles!profile_follows_followee_profile_id_fkey(
        id, handle, display_name, emblem_url, palette_id, ice_color, amber_color, tagline, visibility, location, country_code
      )
    `
    )
    .eq("follower_profile_id", profileId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows: FollowRow[] = (data ?? []).map((row) => ({
    follower_profile_id: row.follower_profile_id,
    followee_profile_id: row.followee_profile_id,
    created_at: row.created_at,
    profile: asCard(row.profile),
  }));
  return hydrateMissingProfiles(rows, "followee_profile_id");
}

export async function fetchFollowers(profileId: string): Promise<FollowRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profile_follows")
    .select(
      `
      follower_profile_id, followee_profile_id, created_at,
      profile:artist_profiles!profile_follows_follower_profile_id_fkey(
        id, handle, display_name, emblem_url, palette_id, ice_color, amber_color, tagline, visibility, location, country_code
      )
    `
    )
    .eq("followee_profile_id", profileId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows: FollowRow[] = (data ?? []).map((row) => ({
    follower_profile_id: row.follower_profile_id,
    followee_profile_id: row.followee_profile_id,
    created_at: row.created_at,
    profile: asCard(row.profile),
  }));
  return hydrateMissingProfiles(rows, "follower_profile_id");
}

export async function blockProfile(
  blockerProfileId: string,
  blockedProfileId: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("profile_blocks").insert({
    blocker_profile_id: blockerProfileId,
    blocked_profile_id: blockedProfileId,
  });
  if (error) throw error;
}

export async function unblockProfile(
  blockerProfileId: string,
  blockedProfileId: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("profile_blocks")
    .delete()
    .eq("blocker_profile_id", blockerProfileId)
    .eq("blocked_profile_id", blockedProfileId);
  if (error) throw error;
}
