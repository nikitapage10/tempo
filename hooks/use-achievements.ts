"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  backfillGamification,
  evaluateAchievements,
  fetchAchievementAwards,
  markAchievementsSeen,
  type AchievementAward,
} from "@/lib/api/achievements";
import { achievementByKey, type AchievementDef } from "@/lib/gamification/achievements";

const BACKFILL_FLAG_PREFIX = "tempo.gamification.backfilled.";

/** One-time-per-artist client flag so an idempotent server call isn't repeated on every mount. */
function hasBackfilled(artistId: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(BACKFILL_FLAG_PREFIX + artistId) === "1";
  } catch {
    return true;
  }
}
function markBackfilled(artistId: string) {
  try {
    localStorage.setItem(BACKFILL_FLAG_PREFIX + artistId, "1");
  } catch {
    /* ignore */
  }
}

export function useAchievementAwards(artistId: string | null) {
  return useQuery({
    queryKey: ["achievement-awards", artistId],
    queryFn: () => fetchAchievementAwards(artistId!),
    enabled: !!artistId,
    staleTime: 30_000,
  });
}

/**
 * Runs the gamification catch-up (backfill once, then evaluate) whenever an
 * artist's sheet mounts, and hands back any achievements that just fired as
 * ready-to-render definitions so the caller can queue toasts. Backfilled
 * awards never appear here — evaluate.ts pre-sets their seen_at, and the
 * one-time backfill call itself returns keys with source='backfill' that
 * this hook doesn't surface as "new" (see the summary count instead).
 */
export function useAchievementSync(artistId: string | null) {
  const qc = useQueryClient();
  const [queue, setQueue] = React.useState<AchievementDef[]>([]);
  const ran = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!artistId || ran.current === artistId) return;
    ran.current = artistId;

    (async () => {
      try {
        if (!hasBackfilled(artistId)) {
          await backfillGamification(artistId);
          markBackfilled(artistId);
        } else {
          const { newlyAwardedKeys } = await evaluateAchievements(artistId);
          const defs = newlyAwardedKeys
            .map((k) => achievementByKey(k))
            .filter((d): d is AchievementDef => !!d);
          if (defs.length > 0) setQueue((prev) => [...prev, ...defs]);
        }
      } catch {
        // Gamification is a bonus layer — a failed sync here should never
        // block the stats page from rendering everything else.
      } finally {
        qc.invalidateQueries({ queryKey: ["achievement-awards", artistId] });
        qc.invalidateQueries({ queryKey: ["artist-point-events", artistId] });
      }
    })();
  }, [artistId, qc]);

  const dequeue = React.useCallback(() => {
    setQueue((prev) => prev.slice(1));
  }, []);

  return { queue, dequeue };
}

/** Manually re-runs evaluate — call after an action likely to earn something (e.g. logging a performance). */
export function useEvaluateAchievements(artistId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => evaluateAchievements(artistId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["achievement-awards", artistId] });
      qc.invalidateQueries({ queryKey: ["artist-point-events", artistId] });
    },
  });
}

export function useMarkAchievementsSeen(artistId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => markAchievementsSeen(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["achievement-awards", artistId] }),
  });
}

export type { AchievementAward };
