import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateAchievements, type EvaluateResult } from "./evaluate";

type AnyClient = SupabaseClient;

/**
 * One-time (but safely repeatable) replay of an artist's pre-existing
 * history into the point ledger, with `source = 'backfill'` throughout.
 * Invoked the first time an artist opens the attribute sheet
 * (app/api/gamification/backfill/route.ts) so two years of real work don't
 * start this feature at zero.
 *
 * Idempotent by construction: every row uses the same deterministic
 * idempotency key the live triggers would have used, and the ledger's
 * `unique(artist_id, idempotency_key)` means re-running this is a no-op —
 * there is no separate "already backfilled" flag to track or drift from.
 *
 * Deliberately does not attempt to recover stage-transition history:
 * activity_events is destination-only and best-effort (failures are
 * silently swallowed in lib/api/tracks.ts), so mining it would bias
 * VELOCITY low with data that was never reliable. VELOCITY starts
 * "measuring since" whatever date the stage_transitions ledger (migration
 * 085) actually began recording, same as any other new artist.
 */
export async function backfillArtist(
  authed: AnyClient,
  admin: AnyClient,
  userId: string,
  artistId: string,
  now: Date = new Date()
): Promise<EvaluateResult> {
  const { data: spaceRows, error: spacesError } = await authed
    .from("spaces")
    .select("id")
    .eq("artist_id", artistId);
  if (spacesError) throw spacesError;
  const spaceIds = (spaceRows ?? []).map((s) => s.id as string);

  const rows: {
    artist_id: string;
    user_id: string;
    rule_key: string;
    attribute: string;
    points: number;
    subject_type: string | null;
    subject_id: string | null;
    occurred_at: string;
    idempotency_key: string;
    source: "backfill";
  }[] = [];

  if (spaceIds.length > 0) {
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
      .select("id, space_id, stage_id, stage_entered_at")
      .in("space_id", spaceIds);
    if (tracksError) throw tracksError;
    const trackIds = (trackRows ?? []).map((t) => t.id as string);

    for (const t of trackRows ?? []) {
      if (!t.stage_id) continue;
      const sort = sortByStage.get(t.stage_id);
      const maxSort = maxSortBySpace.get(t.space_id);
      if (sort !== undefined && maxSort !== undefined && sort >= maxSort) {
        rows.push({
          artist_id: artistId,
          user_id: userId,
          rule_key: "track_finished",
          attribute: "follow_through",
          points: 15,
          subject_type: "track",
          subject_id: t.id,
          occurred_at: t.stage_entered_at,
          idempotency_key: `finished:${t.id}`,
          source: "backfill",
        });
      }
    }

    if (trackIds.length > 0) {
      const { data: versionRows, error: versionsError } = await authed
        .from("versions")
        .select("id, track_id, created_at, milestone_type")
        .in("track_id", trackIds.slice(0, 200));
      if (versionsError) throw versionsError;
      for (const v of versionRows ?? []) {
        rows.push({
          artist_id: artistId,
          user_id: userId,
          rule_key: "bounce_uploaded",
          attribute: "output",
          points: 4,
          subject_type: "version",
          subject_id: v.id,
          occurred_at: v.created_at,
          idempotency_key: `version:${v.id}`,
          source: "backfill",
        });
        if (v.milestone_type === "master") {
          rows.push({
            artist_id: artistId,
            user_id: userId,
            rule_key: "master_uploaded",
            attribute: "output",
            points: 20,
            subject_type: "version",
            subject_id: v.id,
            occurred_at: v.created_at,
            idempotency_key: `version-master:${v.id}`,
            source: "backfill",
          });
        }
      }

      const { data: sessionRows, error: sessionsError } = await authed
        .from("sessions")
        .select("id, track_id, status, ended_at, logged_at")
        .in("track_id", trackIds.slice(0, 200))
        .eq("status", "completed");
      if (sessionsError) throw sessionsError;
      for (const s of sessionRows ?? []) {
        rows.push({
          artist_id: artistId,
          user_id: userId,
          rule_key: "session_completed",
          attribute: "consistency",
          points: 3,
          subject_type: "session",
          subject_id: s.id,
          occurred_at: s.ended_at ?? s.logged_at,
          idempotency_key: `session:${s.id}`,
          source: "backfill",
        });
      }
    }
  }

  const { data: performanceRows, error: performancesError } = await authed
    .from("performances")
    .select("id, context, performed_on")
    .eq("artist_id", artistId);
  if (performancesError) throw performancesError;
  for (const p of performanceRows ?? []) {
    const occurredAt = `${p.performed_on}T12:00:00.000Z`;
    rows.push({
      artist_id: artistId,
      user_id: userId,
      rule_key: "performance_logged",
      attribute: "stage_presence",
      points: 10,
      subject_type: "performance",
      subject_id: p.id,
      occurred_at: occurredAt,
      idempotency_key: `performance:${p.id}`,
      source: "backfill",
    });
    if (p.context === "festival") {
      rows.push({
        artist_id: artistId,
        user_id: userId,
        rule_key: "festival_played",
        attribute: "stage_presence",
        points: 6,
        subject_type: "performance",
        subject_id: p.id,
        occurred_at: occurredAt,
        idempotency_key: `performance-festival:${p.id}`,
        source: "backfill",
      });
    }
  }

  const { data: originRow } = await authed
    .from("artists")
    .select("origin_status, origin_completed_at")
    .eq("id", artistId)
    .maybeSingle();
  if (
    originRow?.origin_status === "complete" ||
    originRow?.origin_status === "legacy_complete"
  ) {
    rows.push({
      artist_id: artistId,
      user_id: userId,
      rule_key: "origin_completed",
      attribute: "follow_through",
      points: 10,
      subject_type: "artist",
      subject_id: artistId,
      occurred_at: originRow.origin_completed_at ?? now.toISOString(),
      idempotency_key: `origin:${artistId}`,
      source: "backfill",
    });
  }

  const { data: onboardingRow } = await authed
    .from("member_onboarding")
    .select("checklist_completed_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (onboardingRow?.checklist_completed_at) {
    rows.push({
      artist_id: artistId,
      user_id: userId,
      rule_key: "onboarding_checklist_completed",
      attribute: "consistency",
      points: 6,
      subject_type: "user",
      subject_id: userId,
      occurred_at: onboardingRow.checklist_completed_at,
      idempotency_key: `onboarding:${userId}`,
      source: "backfill",
    });
  }

  if (rows.length > 0) {
    const { error } = await admin
      .from("artist_point_events")
      .upsert(rows, { onConflict: "artist_id,idempotency_key", ignoreDuplicates: true });
    if (error) throw error;
  }

  return evaluateAchievements(authed, admin, userId, artistId, { source: "backfill", now });
}
