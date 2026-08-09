"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { likePost, unlikePost } from "@/lib/api/feed";
import {
  createScenePost,
  fetchScenePinnedPosts,
  fetchSceneFeed,
  removeScenePost,
  setScenePostPinned,
} from "@/lib/api/scene-feed";
import type { Post, ScenePostKind } from "@/lib/types";

export function useSceneFeed(
  sceneId: string | null,
  topicId: string | null,
  myProfileId: string | null,
  sectionId: string | null = null
) {
  return useQuery({
    queryKey: ["scene-feed", sceneId, topicId, sectionId],
    queryFn: () => fetchSceneFeed(sceneId!, { topicId, myProfileId, sectionId }),
    enabled: !!sceneId,
    staleTime: 15_000,
  });
}

export function useScenePinnedPosts(sceneId: string | null, myProfileId: string | null) {
  return useQuery({
    queryKey: ["scene-feed", sceneId, "pinned"],
    queryFn: () => fetchScenePinnedPosts(sceneId!, myProfileId),
    enabled: !!sceneId,
    staleTime: 15_000,
  });
}

function patchPostInLists(
  qc: ReturnType<typeof useQueryClient>,
  sceneId: string | null,
  postId: string,
  patch: (p: Post) => Post
) {
  const keys = [
    ["scene-feed", sceneId, null],
    ["scene-feed", sceneId, "pinned"],
  ];
  for (const key of keys) {
    qc.setQueryData(key, (old: unknown) =>
      Array.isArray(old) ? old.map((p) => (p.id === postId ? patch(p) : p)) : old
    );
  }
}

export function useSceneFeedMutations(sceneId: string | null, myProfileId: string | null, sectionId: string | null = null) {
  const qc = useQueryClient();

  function invalidateFeed() {
    qc.invalidateQueries({ queryKey: ["scene-feed", sceneId] });
    qc.invalidateQueries({ queryKey: ["scene", sceneId] });
    qc.invalidateQueries({ queryKey: ["scenes"] });
  }

  const create = useMutation({
    mutationFn: (input: {
      topicId?: string | null;
      body: string;
      media?: string[];
      trackId?: string | null;
      kind?: ScenePostKind;
      scheduledFor?: string | null;
    }) => createScenePost({ sceneId: sceneId!, sectionId, authorProfileId: myProfileId!, ...input }),
    onSuccess: invalidateFeed,
  });

  const like = useMutation({
    mutationFn: (postId: string) => likePost(postId, myProfileId!),
    onMutate: (postId) => {
      patchPostInLists(qc, sceneId, postId, (p) => ({
        ...p,
        liked_by_me: true,
        like_count: (p.like_count ?? 0) + 1,
      }));
    },
    onSettled: invalidateFeed,
  });

  const unlike = useMutation({
    mutationFn: (postId: string) => unlikePost(postId, myProfileId!),
    onMutate: (postId) => {
      patchPostInLists(qc, sceneId, postId, (p) => ({
        ...p,
        liked_by_me: false,
        like_count: Math.max((p.like_count ?? 1) - 1, 0),
      }));
    },
    onSettled: invalidateFeed,
  });

  const pin = useMutation({
    mutationFn: ({ postId, pinned }: { postId: string; pinned: boolean }) =>
      setScenePostPinned(postId, pinned),
    onSuccess: invalidateFeed,
  });

  const remove = useMutation({
    mutationFn: ({ postId, note }: { postId: string; note?: string | null }) =>
      removeScenePost(postId, note),
    onSuccess: invalidateFeed,
  });

  return { create, like, unlike, pin, remove };
}
