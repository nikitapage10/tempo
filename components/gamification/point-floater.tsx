"use client";

import { ATTRIBUTE_LABELS, type AttributeKey } from "@/lib/gamification/attributes";
import { cn } from "@/lib/utils";

/**
 * A small "+12 OUTPUT" chip — the quiet half of the two pop-up surfaces.
 * Presentational only; callers own when it mounts and for how long (see
 * useToast().toastCustom, the same queue the achievement toast rides).
 */
export function PointFloater({
  points,
  attribute,
  className,
}: {
  points: number;
  attribute: AttributeKey;
  className?: string;
}) {
  const positive = points >= 0;
  return (
    <div
      className={cn(
        "glass prism-edge-sm inline-flex items-center gap-1.5 rounded-chip px-2.5 py-1.5 shadow-e1",
        "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300",
        className
      )}
      role="status"
    >
      <span
        className={cn(
          "font-data text-xs font-medium tabular-nums",
          positive ? "text-ice" : "text-warn"
        )}
      >
        {positive ? "+" : ""}
        {points}
      </span>
      <span className="label-mono text-[10px] text-text-lo">
        {ATTRIBUTE_LABELS[attribute]}
      </span>
    </div>
  );
}
