"use client";

import * as React from "react";
import { LfWindow } from "@/components/lf-windows";
import { FlareLine } from "@/components/flare-line";
import { PrismShard } from "@/components/gamification/prism-shard";
import type { AchievementDef } from "@/lib/gamification/achievements";
import { cn } from "@/lib/utils";

function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/**
 * The "woo, we did it" moment — grade sets the amplitude, not a second
 * design. A Glimmer slides in quietly with one ice band on its shard; a
 * Corona holds longer and pulses the prism edge once. Same component, same
 * tokens, different scale, so the rare ones feel rare without extra work.
 */
export function AchievementToast({
  achievement,
  onOpenList,
}: {
  achievement: AchievementDef;
  onOpenList?: () => void;
}) {
  const reduced = useReducedMotion();
  const isBig = achievement.grade === "flare" || achievement.grade === "corona";

  return (
    <div
      role="status"
      className={cn(
        "glass-hero prism-edge relative w-full overflow-hidden rounded-card shadow-e3",
        !reduced && "animate-in slide-in-from-right-8 fade-in duration-500",
        !reduced && isBig && "achievement-toast-pulse"
      )}
    >
      <div className="absolute inset-0" aria-hidden>
        <LfWindow field className="absolute inset-0 opacity-70" />
        <div className="scrim-reveal absolute inset-0" />
      </div>

      <button
        type="button"
        onClick={onOpenList}
        className="relative z-[1] flex w-full items-start gap-3 p-3.5 text-left"
      >
        <PrismShard grade={achievement.grade} size={38} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="label-mono text-text-lo">Achievement unlocked</p>
          <p className="mt-0.5 truncate font-display text-sm font-medium tracking-[0.01em] text-text-hi">
            {achievement.name}
          </p>
          <p className="mt-1 text-xs leading-snug text-text-lo">{achievement.flavor}</p>
        </div>
      </button>

      <FlareLine className="relative z-[1] opacity-70" />
    </div>
  );
}
