/**
 * Spectral achievement grades — the deliberate alternative to bronze / silver
 * / gold. TEMPO's signature motif is `.flare-line`, a gradient running
 * transparent → ice → white → amber → transparent, and the whole chart system
 * is an OKLCH lightness ramp over those same two hues (see lib/chart-ramp.ts).
 * Rarity here is a *position on that exact gradient* — how much light an
 * achievement throws — rather than an invented medal system, so a grade
 * never fights an artist's own ice/amber theme.
 *
 * Deliberately split from attribute bands (Dormant/Building/Steady/Strong/
 * Peak): those report your current state and must stay plain, never a rank.
 * Grades describe an achievement's rarity and are allowed to be decorative.
 */

import { CHART_L, atLightness } from "@/lib/chart-ramp";

export type AchievementGrade =
  | "glimmer"
  | "refraction"
  | "flare"
  | "corona"
  | "umbra";

export const GRADE_ORDER: AchievementGrade[] = [
  "glimmer",
  "refraction",
  "flare",
  "corona",
  "umbra",
];

export type GradeStyle = {
  key: AchievementGrade;
  label: string;
  /** "Reads as" line — what earning this grade of achievement signals. */
  reads: string;
  color: string;
  /** How many refracted bands the prism-shard emblem shows — rarity made visible without a second design. */
  facets: number;
  toastDurationMs: number;
};

const GRADE_META: Record<
  AchievementGrade,
  { label: string; reads: string; facets: number; toastDurationMs: number }
> = {
  glimmer: {
    label: "Glimmer",
    reads: "the everyday wins",
    facets: 1,
    toastDurationMs: 3500,
  },
  refraction: {
    label: "Refraction",
    reads: "real craft milestones",
    facets: 2,
    toastDurationMs: 4000,
  },
  flare: {
    label: "Flare",
    reads: "rare, hard-won",
    facets: 3,
    toastDurationMs: 5000,
  },
  corona: {
    label: "Corona",
    reads: "the handful that should stop you",
    facets: 5,
    toastDurationMs: 6000,
  },
  umbra: {
    label: "Umbra",
    reads: "hidden until it fires",
    facets: 2,
    toastDurationMs: 4500,
  },
};

/**
 * Colours travel the flare gradient using the artist's own hues, stepped
 * through the same OKLCH lightness band chart-kit already validated
 * (dark-band PASS, CVD PASS, contrast PASS on #121216) — glimmer sits dim on
 * ice, refraction at full ice chart-strength, corona at full amber. Flare (the
 * white peak) and umbra (unlit violet) are off that ice/amber axis on purpose
 * — one is the gradient's midpoint, the other deliberately isn't on it at all.
 */
export function buildGradeStyles(hues: {
  ice: string;
  amber: string;
}): Record<AchievementGrade, GradeStyle> {
  const colors: Record<AchievementGrade, string> = {
    glimmer: atLightness(hues.ice, 0.5),
    refraction: atLightness(hues.ice, CHART_L.series),
    flare: "var(--text-hi)",
    corona: atLightness(hues.amber, CHART_L.series),
    umbra: "var(--violet)",
  };

  return Object.fromEntries(
    GRADE_ORDER.map((key) => [
      key,
      { key, color: colors[key], ...GRADE_META[key] },
    ])
  ) as Record<AchievementGrade, GradeStyle>;
}
