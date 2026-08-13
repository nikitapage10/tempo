import { createClient } from "@/lib/supabase/client";

export type AchievementAward = {
  id: string;
  achievementKey: string;
  awardedAt: string;
  seenAt: string | null;
  source: "live" | "backfill";
};

export async function fetchAchievementAwards(artistId: string): Promise<AchievementAward[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("artist_achievements")
    .select("id, achievement_key, awarded_at, seen_at, source")
    .eq("artist_id", artistId)
    .order("awarded_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((r) => ({
    id: r.id,
    achievementKey: r.achievement_key,
    awardedAt: r.awarded_at,
    seenAt: r.seen_at,
    source: r.source,
  }));
}

/** Marks a set of awards as seen so they stop queuing as toasts on the next load. */
export async function markAchievementsSeen(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const supabase = createClient();
  const { error } = await supabase
    .from("artist_achievements")
    .update({ seen_at: new Date().toISOString() })
    .in("id", ids)
    .is("seen_at", null);
  if (error) throw error;
}

async function callGamificationRoute(
  path: "evaluate" | "backfill",
  artistId: string
): Promise<{ newlyAwardedKeys: string[] }> {
  const res = await fetch(`/api/gamification/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ artistId }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((json as { error?: string }).error ?? "That request failed.");
  }
  return json as { newlyAwardedKeys: string[] };
}

export function evaluateAchievements(artistId: string) {
  return callGamificationRoute("evaluate", artistId);
}

export function backfillGamification(artistId: string) {
  return callGamificationRoute("backfill", artistId);
}
