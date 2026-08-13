import type { SupabaseClient } from "@supabase/supabase-js";
import { ACHIEVEMENTS } from "./achievements";
import { buildGamificationContext, type GamificationContext } from "./context";

type AnyClient = SupabaseClient;

export type EvaluateResult = {
  context: GamificationContext;
  newlyAwardedKeys: string[];
};

/**
 * Runs every achievement predicate against the current state and awards any
 * newly-earned ones. Server-side only: `admin` must be the service-role
 * client (migration 088 grants no client insert policy on
 * artist_achievements — an achievement that could be granted from the
 * browser wouldn't mean anything). `authed` is the caller's normal,
 * RLS-scoped client, used for every read.
 *
 * The `unique(artist_id, achievement_key)` constraint is what makes this
 * safe to call as often as convenient (every stats page load, say) — a
 * repeat evaluation of an already-earned key is a silent no-op, never a
 * duplicate row or a second toast.
 */
const STALL_THRESHOLD_DAYS = 60;

/**
 * The one follow-through rule that can't be a trigger: a track sitting
 * un-parked outside its final stage for 60+ days is a *duration*, not a
 * discrete write, so nothing fires when it crosses the threshold on its own.
 * Reconciled here instead — cheap (one query, one upsert), safe to run on
 * every evaluate() call, and idempotent per (track, stage) so a long stall
 * is only ever penalised once, not once per page load.
 */
async function reconcileStallPenalties(
  authed: AnyClient,
  admin: AnyClient,
  userId: string,
  artistId: string,
  now: Date
): Promise<void> {
  const { data: spaceRows, error: spacesError } = await authed
    .from("spaces")
    .select("id")
    .eq("artist_id", artistId);
  if (spacesError) throw spacesError;
  const spaceIds = (spaceRows ?? []).map((s) => s.id as string);
  if (spaceIds.length === 0) return;

  const { data: stageRows, error: stagesError } = await authed
    .from("stages")
    .select("id, space_id, sort")
    .in("space_id", spaceIds);
  if (stagesError) throw stagesError;
  const maxSortBySpace = new Map<string, number>();
  for (const s of stageRows ?? []) {
    const prev = maxSortBySpace.get(s.space_id) ?? -Infinity;
    if (s.sort > prev) maxSortBySpace.set(s.space_id, s.sort);
  }
  const sortByStage = new Map((stageRows ?? []).map((s) => [s.id as string, s.sort as number]));

  const { data: trackRows, error: tracksError } = await authed
    .from("tracks")
    .select("id, space_id, stage_id, momentum, stage_entered_at")
    .in("space_id", spaceIds)
    .in("momentum", ["active", "simmering", "stalled"]);
  if (tracksError) throw tracksError;

  const cutoff = now.getTime() - STALL_THRESHOLD_DAYS * 86_400_000;
  const rows = (trackRows ?? [])
    .filter((t) => {
      if (!t.stage_id) return false;
      const sort = sortByStage.get(t.stage_id);
      const maxSort = maxSortBySpace.get(t.space_id);
      if (sort === undefined || maxSort === undefined || sort >= maxSort) return false;
      const entered = new Date(t.stage_entered_at).getTime();
      return entered <= cutoff;
    })
    .map((t) => ({
      artist_id: artistId,
      user_id: userId,
      rule_key: "track_stalled",
      attribute: "follow_through",
      points: -8,
      subject_type: "track",
      subject_id: t.id,
      occurred_at: now.toISOString(),
      idempotency_key: `stall:${t.id}:${t.stage_id}`,
      source: "server",
    }));

  if (rows.length === 0) return;
  const { error } = await admin
    .from("artist_point_events")
    .upsert(rows, { onConflict: "artist_id,idempotency_key", ignoreDuplicates: true });
  if (error) throw error;
}

export async function evaluateAchievements(
  authed: AnyClient,
  admin: AnyClient,
  userId: string,
  artistId: string,
  options: { source?: "live" | "backfill"; now?: Date } = {}
): Promise<EvaluateResult> {
  const now = options.now ?? new Date();
  const source = options.source ?? "live";

  await reconcileStallPenalties(authed, admin, userId, artistId, now);
  const context = await buildGamificationContext(authed, userId, artistId, now);

  const toAward = ACHIEVEMENTS.filter(
    (def) => !context.awardedKeys.has(def.key) && def.check(context.achievementContext)
  );

  if (toAward.length === 0) {
    return { context, newlyAwardedKeys: [] };
  }

  const rows = toAward.map((def) => ({
    artist_id: artistId,
    user_id: userId,
    achievement_key: def.key,
    awarded_at: now.toISOString(),
    seen_at: source === "backfill" ? now.toISOString() : null,
    source,
  }));

  const { error } = await admin
    .from("artist_achievements")
    .upsert(rows, { onConflict: "artist_id,achievement_key", ignoreDuplicates: true });
  if (error) throw error;

  return { context, newlyAwardedKeys: toAward.map((d) => d.key) };
}
