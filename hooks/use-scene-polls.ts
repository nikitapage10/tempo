"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  castScenePollVote,
  closeScenePoll,
  createScenePoll,
  createSceneQuestion,
  fetchScenePollsForPosts,
} from "@/lib/api/scene-polls";

export function useScenePollsForPosts(postIds: string[], myProfileId: string | null) {
  const key = [...postIds].sort().join(",");
  return useQuery({
    queryKey: ["scene-polls", key, myProfileId],
    queryFn: () => fetchScenePollsForPosts(postIds, myProfileId),
    enabled: postIds.length > 0,
    staleTime: 10_000,
  });
}

export function useScenePollMutations(sceneId: string | null) {
  const qc = useQueryClient();

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["scene-polls"] });
    qc.invalidateQueries({ queryKey: ["scene-feed", sceneId] });
  }

  const createPoll = useMutation({
    mutationFn: (input: Omit<Parameters<typeof createScenePoll>[0], "sceneId">) =>
      createScenePoll({ sceneId: sceneId!, ...input }),
    onSuccess: invalidate,
  });

  const createQuestion = useMutation({
    mutationFn: (input: Omit<Parameters<typeof createSceneQuestion>[0], "sceneId">) =>
      createSceneQuestion({ sceneId: sceneId!, ...input }),
    onSuccess: invalidate,
  });

  const vote = useMutation({
    mutationFn: ({
      pollId,
      optionIds,
      profileId,
    }: {
      pollId: string;
      optionIds: string[];
      profileId: string;
    }) => castScenePollVote(pollId, optionIds, profileId),
    onSuccess: invalidate,
  });

  const close = useMutation({
    mutationFn: (pollId: string) => closeScenePoll(pollId),
    onSuccess: invalidate,
  });

  return { createPoll, createQuestion, vote, close };
}
