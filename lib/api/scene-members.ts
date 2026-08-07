import { createClient } from "@/lib/supabase/client";
import { isMissingSceneSchema } from "@/lib/api/scenes";
import type { SceneMember, SceneMemberStatus, SceneRole } from "@/lib/types";

const PROFILE_SELECT =
  "profile:artist_profiles!scene_members_profile_id_fkey(id, handle, display_name, emblem_url, palette_id, ice_color, amber_color, location)";

/**
 * The roster for a scene. RLS lets any active member read every row on a
 * scene they belong to (not just active ones), so this filters to `active`
 * client-side — pending/invited/banned rows are fetched separately by the
 * manager-only queue below.
 */
export async function fetchSceneMembers(sceneId: string): Promise<SceneMember[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scene_members")
    .select(`*, ${PROFILE_SELECT}`)
    .eq("scene_id", sceneId)
    .eq("status", "active")
    .order("role", { ascending: true })
    .order("joined_at", { ascending: true });
  if (error) {
    if (isMissingSceneSchema(error)) return [];
    throw error;
  }
  return normalizeMembers(data);
}

/** Pending join requests. Meaningful only to a manager — RLS permits a
 *  broader read, but the requests queue UI is manager-gated. */
export async function fetchScenePendingRequests(sceneId: string): Promise<SceneMember[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scene_members")
    .select(`*, ${PROFILE_SELECT}`)
    .eq("scene_id", sceneId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) {
    if (isMissingSceneSchema(error)) return [];
    throw error;
  }
  return normalizeMembers(data);
}

export async function fetchMySceneMembership(
  sceneId: string,
  profileId: string
): Promise<SceneMember | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scene_members")
    .select("*")
    .eq("scene_id", sceneId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) {
    if (isMissingSceneSchema(error)) return null;
    throw error;
  }
  return (data as SceneMember) ?? null;
}

function normalizeMembers(rows: unknown): SceneMember[] {
  return ((rows ?? []) as Record<string, unknown>[]).map((row) => {
    const profileRaw = row.profile;
    const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
    return { ...row, profile: profile ?? null } as SceneMember;
  });
}

export async function respondToSceneJoinRequest(
  sceneId: string,
  profileId: string,
  approve: boolean
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("respond_to_scene_join", {
    p_scene_id: sceneId,
    p_profile_id: profileId,
    p_approve: approve,
  });
  if (error) throw error;
}

export async function inviteToScene(sceneId: string, profileId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("invite_to_scene", {
    p_scene_id: sceneId,
    p_profile_id: profileId,
  });
  if (error) throw error;
}

export async function setSceneMemberRole(
  sceneId: string,
  profileId: string,
  role: SceneRole
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("set_scene_member_role", {
    p_scene_id: sceneId,
    p_profile_id: profileId,
    p_role: role,
  });
  if (error) throw error;
}

export async function setSceneMemberBanned(
  sceneId: string,
  profileId: string,
  banned: boolean
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("set_scene_member_banned", {
    p_scene_id: sceneId,
    p_profile_id: profileId,
    p_banned: banned,
  });
  if (error) throw error;
}

/** Mute/unmute, or mark a welcome step done — the caller's own row only. */
export async function updateMySceneMembership(
  sceneId: string,
  profileId: string,
  patch: { muted?: boolean; last_read_at?: string; welcome_steps_done?: string[] }
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("scene_members")
    .update(patch)
    .eq("scene_id", sceneId)
    .eq("profile_id", profileId);
  if (error) throw error;
}

export type { SceneMemberStatus };
