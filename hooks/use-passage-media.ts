"use client";

import * as React from "react";
import type { OriginMediaKey } from "@/lib/origin/media";
import {
  OriginMediaPool,
  networkProfile,
  prefersReducedMotion,
  type NetworkProfile,
} from "@/lib/origin/readiness";
import type { PassagePhase } from "@/lib/passage/reducer";

/**
 * The predictive preload chain for PASSAGE, the same idea as
 * hooks/use-origin-media.ts against Passage's own phase names.
 *
 * Passage plays the identical ten assets in the identical order, so the rule
 * is unchanged: whatever the next interaction needs must already be warm
 * before the member can plausibly trigger it, and nothing speculative
 * competes with the clip currently on screen.
 */
const STAGE_PLAN: Partial<
  Record<PassagePhase, { high: OriginMediaKey[]; low: OriginMediaKey[] }>
> = {
  // The waking screen is dead time, so warm everything the first minute needs.
  awaiting_start: {
    high: ["opening01To02", "loop02"],
    low: ["transition02To03", "loop03"],
  },
  opening: { high: ["loop02"], low: ["transition02To03"] },
  // Typing a name is quick, so its transition has to be ready early.
  name_idle: { high: ["transition02To03", "loop03"], low: [] },
  // Picking chips is quicker still, and the next clip is a heavy one.
  describe_idle: { high: ["transition03To04", "loop04"], low: ["scroll06"] },
  // Writing an answer is the budget for the heaviest assets in the flow.
  entry_idle: {
    high: ["transition04To05", "loop05"],
    low: ["transition05To06", "scroll06"],
  },
  entry_transition: { high: ["loop05"], low: ["transition05To06", "scroll06"] },
  // Everything from here holds on loop05, so the closing pair is all that is left.
  support_idle: { high: ["transition05To06", "scroll06"], low: [] },
  function_idle: { high: ["transition05To06", "scroll06"], low: [] },
  look_idle: { high: ["transition05To06", "scroll06"], low: [] },
  processing: { high: ["transition05To06", "scroll06"], low: [] },
};

/** Assets that must be ready before a phase may be entered. */
export const PASSAGE_PHASE_GATES: Partial<Record<PassagePhase, OriginMediaKey[]>> = {
  recognizing: ["transition02To03", "loop03"],
  describe_transition: ["transition03To04", "loop04"],
  entry_transition: ["transition04To05", "loop05"],
  chapter_opening: ["transition05To06", "scroll06"],
};

export type PassageMediaControl = {
  profile: NetworkProfile;
  staticMode: boolean;
  gateOpen: (keys: OriginMediaKey[]) => boolean;
};

export function usePassageMedia(phase: PassagePhase): PassageMediaControl {
  const [profile] = React.useState<NetworkProfile>(() =>
    typeof window === "undefined" ? "full" : networkProfile()
  );
  const [staticMode] = React.useState(() =>
    typeof window === "undefined"
      ? false
      : prefersReducedMotion() || networkProfile() === "save-data"
  );

  const poolRef = React.useRef<OriginMediaPool | null>(null);
  if (!poolRef.current) poolRef.current = new OriginMediaPool(profile);
  const pool = poolRef.current;

  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => pool.subscribe(bump), [pool]);

  /** Route exit cancels every speculative load. */
  React.useEffect(() => () => pool.destroy(), [pool]);

  React.useEffect(() => {
    if (staticMode) return;
    const plan = STAGE_PLAN[phase];
    if (!plan) return;
    plan.high.forEach((key) => pool.request(key, "high"));
    plan.low.forEach((key) => pool.request(key, "low"));
  }, [phase, pool, staticMode]);

  const gateOpen = React.useCallback(
    (keys: OriginMediaKey[]) => {
      if (staticMode) return true;
      return keys.every((k) => pool.settled(k));
    },
    [pool, staticMode]
  );

  return { profile, staticMode, gateOpen };
}
