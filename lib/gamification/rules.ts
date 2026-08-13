/**
 * The whole artist point economy, in one file.
 *
 * Point *awards* actually happen in Postgres triggers (see
 * migrations/087_artist_point_events.sql) because a trigger is the only way
 * to guarantee every write path that changes a scoreable row is caught, not
 * just the one UI helper that happens to call it today. Since a trigger has
 * to be SQL, the numbers below are a **mirror**, not the source — they exist
 * so the whole economy is readable and diffable in one place instead of
 * spread across four migration files. If you change a value here, change it
 * in the matching trigger too; `test/unit/gamification-rules.test.ts` checks
 * the two stay in sync wherever that's mechanically checkable.
 */

import type { AttributeKey } from "./attributes";

export type PointRule = {
  key: string;
  attribute: AttributeKey;
  points: number;
  /** Maximum awards of this rule per user per calendar day, or null for none. */
  dailyCap: number | null;
  description: string;
};

export const POINT_RULES: PointRule[] = [
  {
    key: "bounce_uploaded",
    attribute: "output",
    points: 4,
    dailyCap: 12,
    description: "A new version (bounce) uploaded to any track.",
  },
  {
    key: "master_uploaded",
    attribute: "output",
    points: 20,
    dailyCap: null,
    description: "A version marked as a master.",
  },
  {
    key: "stage_advanced",
    attribute: "velocity",
    points: 6,
    dailyCap: null,
    description:
      "A track moves forward to a later stage. Scores 12 if the prior stage " +
      "took under a day, 9 if under a week, 6 otherwise. Backward and " +
      "lateral moves never score, and the same (track, from-stage, to-stage) " +
      "pair can only ever score once.",
  },
  {
    key: "session_completed",
    attribute: "consistency",
    points: 3,
    dailyCap: 6,
    description: "A focus session finishes with status completed.",
  },
  {
    key: "performance_logged",
    attribute: "stage_presence",
    points: 10,
    dailyCap: null,
    description: "A performance is logged (any context).",
  },
  {
    key: "festival_played",
    attribute: "stage_presence",
    points: 6,
    dailyCap: null,
    description: "Additional points when a logged performance's context is festival.",
  },
  {
    key: "track_finished",
    attribute: "follow_through",
    points: 15,
    dailyCap: null,
    description:
      "A track reaches its space's terminal (highest-sort) stage for the " +
      "first time. Fired from the same trigger as stage_advanced.",
  },
  {
    key: "track_stalled",
    attribute: "follow_through",
    points: -8,
    dailyCap: null,
    description:
      "A started track has sat, un-parked, in the same non-terminal stage " +
      "for 60+ days. Not a discrete write, so this can't be a trigger — " +
      "lib/gamification/evaluate.ts reconciles it server-side, once per " +
      "(track, stage) so a long stall is only ever penalised once.",
  },
];

export function pointRule(key: string): PointRule | undefined {
  return POINT_RULES.find((r) => r.key === key);
}

/**
 * The trailing window each attribute reads points from. Longer windows for
 * slower-moving axes (reach, stage presence) so a single quiet month doesn't
 * collapse the rating; shorter for the ones meant to reflect *right now*.
 */
export const ATTRIBUTE_WINDOW_DAYS: Record<AttributeKey, number> = {
  output: 365,
  velocity: 180,
  follow_through: 730,
  consistency: 182, // 26 weeks
  stage_presence: 365,
  reach: 90,
};
