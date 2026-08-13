import { ATTRIBUTE_WINDOW_DAYS } from "./rules";

/**
 * Pure attribute derivation from the point ledger.
 *
 * Mirrors the contract of lib/artist-stats.ts and lib/attention/signals.ts:
 * no I/O, `now` is always injected rather than read internally, so this is
 * directly unit-testable and "your sheet 90 days ago" is just calling this
 * again with a shifted `now`.
 *
 * The honesty rule this whole module exists to satisfy: a rating is never a
 * raw score presented as a verdict. It always declares its `basis` — how the
 * 0-100 number should be read — and a missing signal renders `unmeasured`,
 * never a zero. See lib/gamification/rules.ts for what actually earns points.
 */

export type AttributeKey =
  | "output"
  | "velocity"
  | "follow_through"
  | "consistency"
  | "stage_presence"
  | "reach";

export const ATTRIBUTE_ORDER: AttributeKey[] = [
  "output",
  "velocity",
  "follow_through",
  "consistency",
  "stage_presence",
  "reach",
];

export const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  output: "OUTPUT",
  velocity: "VELOCITY",
  follow_through: "FOLLOW-THROUGH",
  consistency: "CONSISTENCY",
  stage_presence: "STAGE PRESENCE",
  reach: "REACH",
};

export type AttributeConfidence = "measured" | "partial" | "unmeasured" | "stale";
export type AttributeBand = "Dormant" | "Building" | "Steady" | "Strong" | "Peak";

export type PointEvent = {
  id: string;
  ruleKey: string;
  attribute: AttributeKey;
  points: number;
  subjectType: string | null;
  subjectId: string | null;
  occurredAt: string;
};

export type Attribute = {
  key: AttributeKey;
  label: string;
  rating: number | null;
  points: number;
  band: AttributeBand;
  confidence: AttributeConfidence;
  headline: string;
  recent: PointEvent[];
  anchors: [raw: number, rating: number][];
  nudge: string | null;
};

export type AttributeDeriveInput = {
  pointEvents: PointEvent[];
  /** At least one real forward stage move (source=trigger) has ever happened. */
  hasMeasuredVelocity: boolean;
  /** When the stage ledger started measuring — null if it hasn't run yet. */
  velocityMeasuringSince: string | null;
  /** The newest platform_snapshots row across every linked platform is 30 days old or newer. */
  reachFresh: boolean;
  hasAnyPlatformSnapshot: boolean;
  hasAnyPerformance: boolean;
};

/**
 * The one place a raw number becomes a 0–100 rating: piecewise-linear
 * interpolation between published anchor points, clamped at both ends.
 * `anchors` must be sorted ascending by raw value and start at [0, 0] or
 * higher — that invariant isn't checked here since every caller in this file
 * supplies a fixed, reviewed table.
 */
export function rateAgainstAnchors(
  raw: number,
  anchors: [raw: number, rating: number][]
): number {
  if (anchors.length === 0) return 0;
  const clampedRaw = Math.max(0, raw);
  if (clampedRaw <= anchors[0][0]) return anchors[0][1];
  const last = anchors[anchors.length - 1];
  if (clampedRaw >= last[0]) return Math.min(100, last[1]);

  for (let i = 0; i < anchors.length - 1; i++) {
    const [x0, y0] = anchors[i];
    const [x1, y1] = anchors[i + 1];
    if (clampedRaw >= x0 && clampedRaw <= x1) {
      if (x1 === x0) return y1;
      const t = (clampedRaw - x0) / (x1 - x0);
      return Math.min(100, Math.max(0, y0 + t * (y1 - y0)));
    }
  }
  return Math.min(100, Math.max(0, last[1]));
}

function bandFor(rating: number): AttributeBand {
  if (rating < 15) return "Dormant";
  if (rating < 40) return "Building";
  if (rating < 65) return "Steady";
  if (rating < 85) return "Strong";
  return "Peak";
}

/**
 * Published anchor curves — raw points earned in the attribute's trailing
 * window (see ATTRIBUTE_WINDOW_DAYS) mapped to a 0–100 rating. These are
 * rendered inline in the UI (never just on tap) precisely so they read as a
 * scale position rather than a verdict handed down — see
 * components/artist/attribute-row.tsx.
 */
const ANCHORS: Record<AttributeKey, [number, number][]> = {
  output: [
    [0, 0],
    [40, 20],
    [120, 45],
    [250, 70],
    [450, 100],
  ],
  velocity: [
    [0, 0],
    [20, 25],
    [60, 55],
    [150, 80],
    [300, 100],
  ],
  follow_through: [
    [-40, 0],
    [0, 30],
    [30, 55],
    [75, 80],
    [150, 100],
  ],
  consistency: [
    [0, 0],
    [18, 25],
    [45, 50],
    [90, 75],
    [156, 100], // ~26 weeks of session/bounce activity at 3pts each, un-capped by daily limits
  ],
  stage_presence: [
    [0, 0],
    [10, 20],
    [40, 45],
    [120, 75],
    [240, 100],
  ],
  reach: [
    [0, 0],
    [50, 20],
    [150, 45],
    [400, 70],
    [800, 100],
  ],
};

function windowedSum(
  events: PointEvent[],
  attribute: AttributeKey,
  windowStart: Date,
  now: Date
): { raw: number; recent: PointEvent[] } {
  const inWindow = events
    .filter((e) => e.attribute === attribute)
    .filter((e) => {
      const t = new Date(e.occurredAt).getTime();
      return t >= windowStart.getTime() && t <= now.getTime();
    })
    .sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
    );
  const raw = inWindow.reduce((sum, e) => sum + e.points, 0);
  return { raw, recent: inWindow.slice(0, 8) };
}

function headlineFor(
  key: AttributeKey,
  raw: number,
  recent: PointEvent[],
  windowDays: number
): string {
  const windowLabel =
    windowDays >= 360 ? "the last 12 months" : `the last ${Math.round(windowDays / 7)} weeks`;
  const finishedCount = recent.filter((e) => e.ruleKey === "track_finished").length;
  const bounceCount = recent.filter((e) => e.ruleKey === "bounce_uploaded").length;
  const stageMoves = recent.filter((e) => e.ruleKey === "stage_advanced").length;
  const sessionCount = recent.filter((e) => e.ruleKey === "session_completed").length;
  const showCount = recent.filter((e) => e.ruleKey === "performance_logged").length;
  const festivalCount = recent.filter((e) => e.ruleKey === "festival_played").length;

  switch (key) {
    case "output":
      return `${raw} output points from ${bounceCount} bounce${bounceCount === 1 ? "" : "s"} in ${windowLabel}.`;
    case "velocity":
      return `${raw} velocity points from ${stageMoves} forward stage move${stageMoves === 1 ? "" : "s"} in ${windowLabel}.`;
    case "follow_through":
      return finishedCount > 0
        ? `${raw} follow-through points — ${finishedCount} track${finishedCount === 1 ? "" : "s"} reached a final stage in ${windowLabel}.`
        : `${raw} follow-through points in ${windowLabel}.`;
    case "consistency":
      return `${raw} consistency points from ${sessionCount} logged session${sessionCount === 1 ? "" : "s"} and other activity in ${windowLabel}.`;
    case "stage_presence":
      return `${raw} stage presence points from ${showCount} logged performance${showCount === 1 ? "" : "s"}${festivalCount > 0 ? ` (${festivalCount} of them festivals)` : ""} in ${windowLabel}.`;
    case "reach":
      return `${raw} reach points from platform growth in ${windowLabel}.`;
  }
}

function nudgeFor(key: AttributeKey, raw: number): string | null {
  switch (key) {
    case "follow_through":
      return raw < 0
        ? "A stalled track is pulling this down — unpark or advance one to start it recovering."
        : null;
    case "velocity":
      return raw === 0
        ? "No forward moves yet this window — advancing any track a stage starts this measuring."
        : null;
    case "stage_presence":
      return raw === 0 ? "Log a show to start measuring this." : null;
    default:
      return null;
  }
}

export function deriveAttributes(
  input: AttributeDeriveInput,
  now: Date
): Attribute[] {
  return ATTRIBUTE_ORDER.map((key) => {
    const windowDays = ATTRIBUTE_WINDOW_DAYS[key];
    const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
    const { raw, recent } = windowedSum(input.pointEvents, key, windowStart, now);
    const anchors = ANCHORS[key];

    let confidence: AttributeConfidence = "measured";
    let rating: number | null = rateAgainstAnchors(raw, anchors);
    let headline = headlineFor(key, raw, recent, windowDays);

    if (key === "velocity" && !input.hasMeasuredVelocity) {
      confidence = "unmeasured";
      rating = null;
      headline = input.velocityMeasuringSince
        ? `Measuring since ${new Date(input.velocityMeasuringSince).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })} — no forward move has landed yet.`
        : "Not measuring yet.";
    } else if (key === "stage_presence" && !input.hasAnyPerformance) {
      confidence = "unmeasured";
      rating = null;
      headline = "Log a show to start measuring this.";
    } else if (key === "reach" && !input.hasAnyPlatformSnapshot) {
      confidence = "unmeasured";
      rating = null;
      headline = "Link Spotify or SoundCloud to start measuring this.";
    } else if (key === "reach" && !input.reachFresh) {
      confidence = "stale";
      rating = null;
      headline = "Your last platform refresh is over 30 days old — refresh to see a current number.";
    }

    return {
      key,
      label: ATTRIBUTE_LABELS[key],
      rating,
      points: raw,
      band: bandFor(rating ?? 0),
      confidence,
      headline,
      recent,
      anchors,
      nudge: nudgeFor(key, raw),
    };
  });
}
