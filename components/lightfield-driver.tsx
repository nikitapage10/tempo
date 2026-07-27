"use client";

/**
 * Wires app state into the Lightfield driver (tempo, stage warmth, weekly activity).
 * Mount inside authenticated app shell only.
 */

import * as React from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useActiveSpace } from "@/components/active-space-provider";
import { useStages } from "@/hooks/use-stages";
import { useTrack, useTracks } from "@/hooks/use-tracks";
import { countSessionsThisWeek } from "@/lib/api/sessions";
import { countVersionsThisWeek } from "@/lib/api/versions";
import {
  averageStageProgress,
  setIntensityFromWeeklyActivity,
  setTempoFromBpm,
  setWarmthFromStageProgress,
  stageProgress,
} from "@/lib/lightfield";

function trackIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/track\/([^/]+)/);
  return m?.[1] ?? null;
}

export function LightfieldDriver() {
  const pathname = usePathname();
  const trackId = trackIdFromPath(pathname);
  const onBoard = pathname === "/board" || pathname.startsWith("/board/");
  const { activeSpaceId } = useActiveSpace();

  const trackQuery = useTrack(trackId);
  const stagesQuery = useStages(
    trackQuery.data?.space_id ?? activeSpaceId ?? null
  );
  const tracksQuery = useTracks(onBoard ? activeSpaceId : null);

  const activityQuery = useQuery({
    queryKey: ["lightfield-weekly-activity"],
    queryFn: async () => {
      const [sessions, versions] = await Promise.all([
        countSessionsThisWeek(),
        countVersionsThisWeek(),
      ]);
      return sessions + versions;
    },
    staleTime: 60_000,
  });

  React.useEffect(() => {
    if (activityQuery.data == null) return;
    setIntensityFromWeeklyActivity(activityQuery.data);
  }, [activityQuery.data]);

  React.useEffect(() => {
    const stages = stagesQuery.data ?? [];

    if (trackId && trackQuery.data) {
      setTempoFromBpm(trackQuery.data.bpm);
      setWarmthFromStageProgress(
        stageProgress(trackQuery.data.stage_id, stages)
      );
      return;
    }

    setTempoFromBpm(null);

    if (onBoard && tracksQuery.data) {
      setWarmthFromStageProgress(
        averageStageProgress(tracksQuery.data, stages)
      );
      return;
    }

    // Today and everywhere else: neutral warmth
    setWarmthFromStageProgress(null);
  }, [
    trackId,
    trackQuery.data,
    stagesQuery.data,
    onBoard,
    tracksQuery.data,
  ]);

  return null;
}
