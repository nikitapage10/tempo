"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSceneTopic, fetchSceneTopics } from "@/lib/api/scene-topics";

export function useSceneTopics(sceneId: string | null) {
  return useQuery({
    queryKey: ["scene-topics", sceneId],
    queryFn: () => fetchSceneTopics(sceneId!),
    enabled: !!sceneId,
    staleTime: 30_000,
  });
}

export function useSceneTopicMutations(sceneId: string | null) {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: (input: Omit<Parameters<typeof createSceneTopic>[0], "sceneId">) =>
      createSceneTopic({ sceneId: sceneId!, ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scene-topics", sceneId] }),
  });

  return { create };
}
