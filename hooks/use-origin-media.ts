"use client";

import * as React from "react";
import type { OriginMediaKey } from "@/lib/origin/media";
import {
  OriginMediaPool,
  networkProfile,
  prefersReducedMotion,
  type NetworkProfile,
} from "@/lib/origin/readiness";
import type { OriginPhase } from "@/lib/origin/reducer";

/**
 * The predictive preload chain (§10).
 *
 * Each stable phase declares what to warm while it holds. The rule throughout:
 * the next interaction's transition AND its destination loop must both be ready
 * before the artist can plausibly trigger them, and background work never
 * competes with the asset currently on screen.
 */
const STAGE_PLAN: Partial<
  Record<OriginPhase, { high: OriginMediaKey[]; low: OriginMediaKey[] }>
> = {
  // Nothing else competes with the opening film.
  opening: { high: ["loop02"], low: [] },
  // The artist is typing; this normally finishes well before they submit.
  name_idle: { high: ["transition02To03", "loop03"], low: [] },
  // Speaking takes ~30s+ — the budget for the heaviest assets in the flow.
  introduction_idle: { high: ["transition03To04", "loop04"], low: ["scroll06"] },
  recording: { high: ["transition03To04", "loop04"], low: ["scroll06"] },
  processing: { high: ["transition04To05", "loop05"], low: ["scroll06"] },
  // Review can stay open indefinitely; finish the scroll asset here.
  review: { high: ["transition05To06", "scroll06"], low: [] },
};

export type OriginMediaControl = {
  pool: OriginMediaPool;
  profile: NetworkProfile;
  /** True when no video should play at all — reduced motion or Save Data. */
  staticMode: boolean;
  isReady: (key: OriginMediaKey) => boolean;
  settled: (key: OriginMediaKey) => boolean;
  progress: (key: OriginMediaKey) => number;
  /** Readiness of a gate, 0–1, for restrained "preparing" copy. */
  gateProgress: (keys: OriginMediaKey[]) => number;
  /** True when every key is ready (or has failed, so the flow can't deadlock). */
  gateOpen: (keys: OriginMediaKey[]) => boolean;
};

export function useOriginMedia(phase: OriginPhase): OriginMediaControl {
  const [profile] = React.useState<NetworkProfile>(() =>
    typeof window === "undefined" ? "full" : networkProfile()
  );
  const [staticMode] = React.useState(() =>
    typeof window === "undefined" ? false : prefersReducedMotion() || networkProfile() === "save-data"
  );

  const poolRef = React.useRef<OriginMediaPool | null>(null);
  if (!poolRef.current) poolRef.current = new OriginMediaPool(profile);
  const pool = poolRef.current;

  // Bumped only when a readiness *category* changes — buffered seconds tick
  // continuously and must not drive React.
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => pool.subscribe(bump), [pool]);

  /** Route exit cancels every speculative load. */
  React.useEffect(() => () => pool.destroy(), [pool]);

  /** Stage the chain for the current phase. */
  React.useEffect(() => {
    if (staticMode) return;
    const plan = STAGE_PLAN[phase];
    if (!plan) return;
    plan.high.forEach((key) => pool.request(key, "high"));
    plan.low.forEach((key) => pool.request(key, "low"));
  }, [phase, pool, staticMode]);

  const isReady = React.useCallback((key: OriginMediaKey) => pool.isReady(key), [pool]);
  const settled = React.useCallback((key: OriginMediaKey) => pool.settled(key), [pool]);
  const progress = React.useCallback((key: OriginMediaKey) => pool.progress(key), [pool]);

  const gateOpen = React.useCallback(
    (keys: OriginMediaKey[]) => {
      if (staticMode) return true;
      return keys.every((k) => pool.settled(k));
    },
    [pool, staticMode]
  );

  const gateProgress = React.useCallback(
    (keys: OriginMediaKey[]) => {
      if (staticMode || keys.length === 0) return 1;
      const total = keys.reduce(
        (sum, k) => sum + (pool.isReady(k) ? 1 : Math.min(0.95, pool.progress(k))),
        0
      );
      return total / keys.length;
    },
    [pool, staticMode]
  );

  return { pool, profile, staticMode, isReady, settled, progress, gateProgress, gateOpen };
}

/**
 * Assets that must be ready before a phase may be entered. Gating on the
 * destination — never on what is currently playing — is what stops the flow
 * transitioning into something it cannot immediately show.
 */
export const PHASE_GATES: Partial<Record<OriginPhase, OriginMediaKey[]>> = {
  recognizing: ["transition02To03", "loop03"],
  interpreting_transition: ["transition03To04", "loop04"],
  resolving: ["transition04To05", "loop05"],
  chapter_opening: ["transition05To06", "scroll06"],
};
