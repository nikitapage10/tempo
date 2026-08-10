import { createClient } from "@/lib/supabase/client";

export type ActivationGuidePreference = {
  id: string;
  user_id: string;
  artist_id: string;
  hidden_at: string | null;
  snoozed_until: string | null;
  completed_acknowledged_at: string | null;
  restored_at: string | null;
};

export async function fetchActivationGuidePreference(
  artistId: string
): Promise<ActivationGuidePreference | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("activation_guide_preferences")
    .select("*")
    .eq("artist_id", artistId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function upsertPreference(
  artistId: string,
  patch: Partial<
    Pick<
      ActivationGuidePreference,
      "hidden_at" | "snoozed_until" | "completed_acknowledged_at" | "restored_at"
    >
  >
): Promise<ActivationGuidePreference> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("You’re signed out — sign in again, then retry.");

  const { data, error } = await supabase
    .from("activation_guide_preferences")
    .upsert(
      { user_id: userData.user.id, artist_id: artistId, ...patch },
      { onConflict: "user_id,artist_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** "Not now" — snoozes for seven days. */
export async function snoozeActivationGuide(artistId: string): Promise<ActivationGuidePreference> {
  const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  return upsertPreference(artistId, { snoozed_until: until });
}

/** "Hide this guide" — persistent until explicitly restored in Settings. */
export async function hideActivationGuide(artistId: string): Promise<ActivationGuidePreference> {
  return upsertPreference(artistId, { hidden_at: new Date().toISOString() });
}

/** Settings → "Start over" / restore. */
export async function restoreActivationGuide(artistId: string): Promise<ActivationGuidePreference> {
  return upsertPreference(artistId, {
    hidden_at: null,
    snoozed_until: null,
    completed_acknowledged_at: null,
    restored_at: new Date().toISOString(),
  });
}

export async function acknowledgeActivationLoopComplete(
  artistId: string
): Promise<ActivationGuidePreference> {
  return upsertPreference(artistId, { completed_acknowledged_at: new Date().toISOString() });
}
