"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  escalateSceneReport,
  fetchOpenSceneReportCount,
  fetchSceneModerationLog,
} from "@/lib/api/scene-moderation";

export function useSceneModerationLog(sceneId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["scene-moderation-log", sceneId],
    queryFn: () => fetchSceneModerationLog(sceneId!),
    enabled: !!sceneId && enabled,
  });
}

export function useOpenSceneReportCount(sceneId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["scene-open-reports", sceneId],
    queryFn: () => fetchOpenSceneReportCount(sceneId!),
    enabled: !!sceneId && enabled,
    staleTime: 15_000,
  });
}

export function useSceneModerationMutations(sceneId: string | null) {
  const qc = useQueryClient();

  const escalate = useMutation({
    mutationFn: (input: Omit<Parameters<typeof escalateSceneReport>[0], "sceneId">) =>
      escalateSceneReport({ sceneId: sceneId!, ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scene-moderation-log", sceneId] }),
  });

  return { escalate };
}
