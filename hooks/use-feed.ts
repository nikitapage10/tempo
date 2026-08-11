"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPost,
  createPostComment,
  fetchHomeTimeline,
  fetchPost,
  fetchPostComments,
  likePost,
  softDeletePost,
  unlikePost,
} from "@/lib/api/feed";
import type { Post, PostVisibility } from "@/lib/types";

export function useHomeTimeline(myProfileId: string | null) {
  return useQuery({
    queryKey: ["home-timeline", myProfileId],
    queryFn: () => fetchHomeTimeline({ myProfileId: myProfileId ?? undefined }),
    enabled: !!myProfileId,
    staleTime: 15_000,
  });
}

export function usePost(postId: string | null, myProfileId: string | null) {
  return useQuery({
    queryKey: ["post", postId],
    queryFn: () => fetchPost(postId!, myProfileId ?? undefined),
    enabled: !!postId,
  });
}

export function usePostComments(postId: string | null) {
  return useQuery({
    queryKey: ["post-comments", postId],
    queryFn: () => fetchPostComments(postId!),
    enabled: !!postId,
  });
}

export function useFeedMutations(myProfileId: string | null) {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: (input: {
      body: string;
      media?: string[];
      trackId?: string | null;
      visibility?: PostVisibility;
    }) =>
      createPost({
        authorProfileId: myProfileId!,
        ...input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["home-timeline"] }),
  });

  const remove = useMutation({
    mutationFn: (postId: string) => softDeletePost(postId),
    onMutate: async (postId) => {
      await qc.cancelQueries({ queryKey: ["home-timeline"] });
      const timelines = qc.getQueriesData<Post[]>({
        queryKey: ["home-timeline"],
      });
      qc.setQueriesData<Post[]>({ queryKey: ["home-timeline"] }, (posts) =>
        posts?.filter((post) => post.id !== postId)
      );
      return { timelines };
    },
    onError: (_error, _postId, context) => {
      for (const [key, posts] of context?.timelines ?? []) {
        qc.setQueryData(key, posts);
      }
    },
    onSuccess: (_data, postId) => {
      qc.removeQueries({ queryKey: ["post", postId], exact: true });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["home-timeline"] }),
  });

  const like = useMutation({
    mutationFn: (postId: string) => likePost(postId, myProfileId!),
    onMutate: async (postId) => {
      await qc.cancelQueries({ queryKey: ["home-timeline", myProfileId] });
      const prev = qc.getQueryData(["home-timeline", myProfileId]);
      qc.setQueryData(["home-timeline", myProfileId], (old: unknown) => {
        if (!Array.isArray(old)) return old;
        return old.map((p) =>
          p.id === postId
            ? { ...p, liked_by_me: true, like_count: (p.like_count ?? 0) + 1 }
            : p
        );
      });
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["home-timeline", myProfileId], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["home-timeline"] }),
  });

  const unlike = useMutation({
    mutationFn: (postId: string) => unlikePost(postId, myProfileId!),
    onMutate: async (postId) => {
      await qc.cancelQueries({ queryKey: ["home-timeline", myProfileId] });
      const prev = qc.getQueryData(["home-timeline", myProfileId]);
      qc.setQueryData(["home-timeline", myProfileId], (old: unknown) => {
        if (!Array.isArray(old)) return old;
        return old.map((p) =>
          p.id === postId
            ? {
                ...p,
                liked_by_me: false,
                like_count: Math.max((p.like_count ?? 1) - 1, 0),
              }
            : p
        );
      });
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["home-timeline", myProfileId], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["home-timeline"] }),
  });

  const comment = useMutation({
    mutationFn: (input: {
      postId: string;
      body: string;
      parentCommentId?: string | null;
    }) =>
      createPostComment({
        postId: input.postId,
        authorProfileId: myProfileId!,
        body: input.body,
        parentCommentId: input.parentCommentId,
      }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["post-comments", vars.postId] });
      qc.invalidateQueries({ queryKey: ["home-timeline"] });
      qc.invalidateQueries({ queryKey: ["post", vars.postId] });
    },
  });

  return { create, remove, like, unlike, comment };
}
