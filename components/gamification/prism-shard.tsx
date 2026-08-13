"use client";

import * as React from "react";
import { useActiveArtistPalette } from "@/components/active-artist-provider";
import { buildGradeStyles, type AchievementGrade } from "@/lib/gamification/grades";
import { cn } from "@/lib/utils";

/**
 * The achievement emblem — a small angular shard that refracts the artist's
 * own ice/amber flare gradient across its facets, the number of facets
 * widening by grade (Glimmer: one narrow band, Corona: the full spread).
 * One shape, one component, five grades — not five separate badge assets.
 */
export function useGradeStyles() {
  const hues = useActiveArtistPalette();
  return React.useMemo(
    () => buildGradeStyles({ ice: hues.ice, amber: hues.amber }),
    [hues.ice, hues.amber]
  );
}

export function PrismShard({
  grade,
  earned = true,
  size = 40,
  className,
}: {
  grade: AchievementGrade;
  /** Umbra renders unlit — no facets, no colour — until earned. */
  earned?: boolean;
  size?: number;
  className?: string;
}) {
  const styles = useGradeStyles();
  const style = styles[grade];
  const dim = grade === "umbra" && !earned;

  // A simple angular hexagon-ish shard, faceted by evenly-spaced chords —
  // more facets = more refracted bands, which is the rarity signal.
  const facets = dim ? 0 : style.facets;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;

  const outline = `M${cx},${cy - r} L${cx + r * 0.87},${cy - r * 0.5} L${cx + r * 0.87},${cy + r * 0.5} L${cx},${cy + r} L${cx - r * 0.87},${cy + r * 0.5} L${cx - r * 0.87},${cy - r * 0.5} Z`;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <path
        d={outline}
        fill={dim ? "rgba(139,139,150,0.08)" : `${style.color}22`}
        stroke={dim ? "rgba(139,139,150,0.35)" : style.color}
        strokeWidth={1.25}
      />
      {Array.from({ length: facets }, (_, i) => {
        const t = facets === 1 ? 0.5 : i / (facets - 1);
        const x1 = cx - r * 0.87 + t * (r * 1.74);
        return (
          <line
            key={i}
            x1={x1}
            y1={cy - r * 0.7}
            x2={x1}
            y2={cy + r * 0.7}
            stroke={style.color}
            strokeWidth={1}
            opacity={0.55}
          />
        );
      })}
      <circle cx={cx} cy={cy} r={2} fill={dim ? "rgba(139,139,150,0.4)" : style.color} />
    </svg>
  );
}
