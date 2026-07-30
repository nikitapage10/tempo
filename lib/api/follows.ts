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
>;

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

export async function fetchFollowing(
  profileId: string
): Promise<(ProfileFollow & { profile: ProfileCard | null })[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profile_follows")
    .select(
      `
      follower_profile_id, followee_profile_id, created_at,
      profile:artist_profiles!profile_follows_followee_profile_id_fkey(
        id, handle, display_name, emblem_url, palette_id, ice_color, amber_color, tagline, visibility
      )
    `
    )
    .eq("follower_profile_id", profileId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const profileRaw = row.profile as unknown;
    const profile = (Array.isArray(profileRaw) ? profileRaw[0] : profileRaw) as ProfileCard | null;
    return {
      follower_profile_id: row.follower_profile_id,
      followee_profile_id: row.followee_profile_id,
      created_at: row.created_at,
      profile: profile ?? null,
    };
  });
}

export async function fetchFollowers(
  profileId: string
): Promise<(ProfileFollow & { profile: ProfileCard | null })[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profile_follows")
    .select(
      `
      follower_profile_id, followee_profile_id, created_at,
      profile:artist_profiles!profile_follows_follower_profile_id_fkey(
        id, handle, display_name, emblem_url, palette_id, ice_color, amber_color, tagline, visibility
      )
    `
    )
    .eq("followee_profile_id", profileId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const profileRaw = row.profile as unknown;
    const profile = (Array.isArray(profileRaw) ? profileRaw[0] : profileRaw) as ProfileCard | null;
    return {
      follower_profile_id: row.follower_profile_id,
      followee_profile_id: row.followee_profile_id,
      created_at: row.created_at,
      profile: profile ?? null,
    };
  });
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
