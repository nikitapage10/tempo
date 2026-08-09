import { createClient } from "@/lib/supabase/client";

export async function createSceneInviteLink(input: { sceneId: string; label?: string | null; maxUses?: number; expiresInDays?: number | null }): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_scene_invite_link", { p_scene_id: input.sceneId, p_label: input.label?.trim() || null, p_max_uses: input.maxUses ?? 1, p_expires_in_days: input.expiresInDays ?? null });
  if (error) throw error;
  return data as string;
}

export async function redeemSceneInviteLink(token: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("redeem_scene_invite_link", { p_token: token });
  if (error) throw error;
  return data as string;
}
