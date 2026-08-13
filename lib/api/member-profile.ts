import { createClient } from "@/lib/supabase/client";
import { buildMemberAvatarPath, deleteFile, uploadFile } from "@/lib/storage";

export type MemberProfile = {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
};

function isMissingSchema(error: { message?: string }): boolean {
  return /artist_member_profiles|schema cache|does not exist/i.test(error?.message ?? "");
}

/** The signed-in user's own team-facing name/photo — separate from any one artist's grants (migration 091). */
export async function fetchMyMemberProfile(): Promise<MemberProfile | null> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const { data, error } = await supabase
    .from("artist_member_profiles")
    .select("user_id, display_name, avatar_url")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (error) {
    if (isMissingSchema(error)) return null;
    throw new Error(error.message);
  }
  if (!data) return { userId: userData.user.id, displayName: null, avatarUrl: null };
  return { userId: data.user_id, displayName: data.display_name, avatarUrl: data.avatar_url };
}

/** Profiles of everyone actively on the given artist's team — RLS only returns rows the caller (the artist owner) can see. */
export async function fetchMemberProfiles(userIds: string[]): Promise<Map<string, MemberProfile>> {
  const map = new Map<string, MemberProfile>();
  if (userIds.length === 0) return map;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("artist_member_profiles")
    .select("user_id, display_name, avatar_url")
    .in("user_id", userIds);
  if (error) {
    if (isMissingSchema(error)) return map;
    throw new Error(error.message);
  }
  for (const row of data ?? []) {
    map.set(row.user_id, {
      userId: row.user_id,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
    });
  }
  return map;
}

export async function updateMyMemberProfile(patch: {
  displayName?: string | null;
}): Promise<MemberProfile> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("You’re signed out — sign in again, then retry.");

  const { data, error } = await supabase
    .from("artist_member_profiles")
    .upsert(
      { user_id: userData.user.id, display_name: patch.displayName ?? null },
      { onConflict: "user_id" }
    )
    .select("user_id, display_name, avatar_url")
    .single();
  if (error) throw new Error(error.message);
  return { userId: data.user_id, displayName: data.display_name, avatarUrl: data.avatar_url };
}

export async function uploadMyMemberAvatar(file: File): Promise<MemberProfile> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("You’re signed out — sign in again, then retry.");

  const existing = await fetchMyMemberProfile();
  const path = buildMemberAvatarPath({ userId: userData.user.id, filename: file.name });
  await uploadFile(path, file, { contentType: file.type || undefined });

  const { data, error } = await supabase
    .from("artist_member_profiles")
    .upsert({ user_id: userData.user.id, avatar_url: path }, { onConflict: "user_id" })
    .select("user_id, display_name, avatar_url")
    .single();
  if (error) throw new Error(error.message);

  if (existing?.avatarUrl && existing.avatarUrl !== path) {
    void deleteFile(existing.avatarUrl).catch(() => {});
  }
  return { userId: data.user_id, displayName: data.display_name, avatarUrl: data.avatar_url };
}
