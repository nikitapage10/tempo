"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPointEvents, fetchStageTransitionFlags } from "@/lib/api/point-events";
import { fetchPlatformSnapshots } from "@/lib/api/platform-stats";
import { fetchPerformances } from "@/lib/api/performances";
import { deriveAttributes, type Attribute } from "@/lib/gamification/attributes";
import type { Artist } from "@/lib/types";

/**
 * The artist's attribute sheet, derived client-side from the point ledger —
 * `deriveAttributes` is pure, so this hook is just "fetch the ledger and the
 * few flags it can't infer on its own, then run the real function," the same
 * shape as useArtistStats over summarizeArtist.
 */
export function useArtistAttributes(artist: Artist | null): {
  data: Attribute[] | undefined;
  isLoading: boolean;
  isError: boolean;
} {
  const artistId = artist?.id ?? null;
  const ownerUserId = artist?.user_id ?? null;

  const pointsQuery = useQuery({
    queryKey: ["artist-point-events", artistId],
    queryFn: () => fetchPointEvents(artistId!),
    enabled: !!artistId,
    staleTime: 30_000,
  });

  const velocityQuery = useQuery({
    queryKey: ["stage-transition-flags", ownerUserId],
    queryFn: () => fetchStageTransitionFlags(ownerUserId!),
    enabled: !!ownerUserId,
    staleTime: 60_000,
  });

  const snapshotsQuery = useQuery({
    queryKey: ["artist-attribute-snapshots", artistId],
    queryFn: () => fetchPlatformSnapshots(artistId!),
    enabled: !!artistId,
    staleTime: 60_000,
  });

  const performancesQuery = useQuery({
    queryKey: ["artist-attribute-performances", artistId],
    queryFn: () => fetchPerformances(artistId!),
    enabled: !!artistId,
    staleTime: 60_000,
  });

  const isLoading =
    pointsQuery.isLoading ||
    velocityQuery.isLoading ||
    snapshotsQuery.isLoading ||
    performancesQuery.isLoading;
  const isError =
    pointsQuery.isError ||
    velocityQuery.isError ||
    snapshotsQuery.isError ||
    performancesQuery.isError;

  const data = React.useMemo(() => {
    if (!pointsQuery.data || !velocityQuery.data || !snapshotsQuery.data || !performancesQuery.data) {
      return undefined;
    }

    const newest = [...snapshotsQuery.data].sort((a, b) =>
      b.captured_on.localeCompare(a.captured_on)
    )[0];
    const reachFresh = newest
      ? Date.now() - new Date(`${newest.captured_on}T12:00:00`).getTime() <= 30 * 86_400_000
      : false;

    return deriveAttributes(
      {
        pointEvents: pointsQuery.data,
        hasMeasuredVelocity: velocityQuery.data.hasMeasuredVelocity,
        velocityMeasuringSince: velocityQuery.data.velocityMeasuringSince,
        reachFresh,
        hasAnyPlatformSnapshot: snapshotsQuery.data.length > 0,
        hasAnyPerformance: performancesQuery.data.length > 0,
      },
      new Date()
    );
  }, [pointsQuery.data, velocityQuery.data, snapshotsQuery.data, performancesQuery.data]);

  return { data, isLoading, isError };
}
