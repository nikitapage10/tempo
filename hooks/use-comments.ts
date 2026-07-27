"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  countCommentsForVersion,
  countUnresolved,
  createComment,
  deleteComment,
  fetchComments,
  reopenComment,
  resolveComment,
  updateComment,
  type CreateCommentInput,
  type UpdateCommentInput,
  type VersionFilter,
} from "@/lib/api/comments";
import type { Comment } from "@/lib/types";

export function useComments(
  trackId: string | null,
  versionId: VersionFilter = "all"
) {
  return useQuery({
    queryKey: ["comments", trackId, versionId],
    queryFn: () => fetchComments(trackId!, versionId),
    enabled: !!trackId,
  });
}

export function useUnresolvedCommentCount(trackId: string | null) {
  return useQuery({
    queryKey: ["comment-count", trackId],
    queryFn: () => countUnresolved(trackId!),
    enabled: !!trackId,
  });
}

/** Comment count for one version — used by the version delete-confirm copy. */
export function useVersionCommentCount(versionId: string | null) {
  return useQuery({
    queryKey: ["comment-count-version", versionId],
    queryFn: () => countCommentsForVersion(versionId!),
    enabled: !!versionId,
  });
}

export function useCommentMutations(
  trackId: string | null,
  versionId: VersionFilter = "all"
) {
  const qc = useQueryClient();
  const key = ["comments", trackId, versionId] as const;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["comments", trackId] });
    qc.invalidateQueries({ queryKey: ["comment-count", trackId] });
  };

  const create = useMutation({
    mutationFn: (input: Omit<CreateCommentInput, "trackId">) =>
      createComment({ ...input, trackId: trackId! }),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateCommentInput }) =>
      updateComment(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Comment[]>(key);
      if (prev) {
        qc.setQueryData<Comment[]>(
          key,
          prev.map((c) =>
            c.id === id
              ? {
                  ...c,
                  ...(patch.text !== undefined ? { text: patch.text } : {}),
                  ...(patch.assignedToUserId !== undefined
                    ? { assigned_to_user_id: patch.assignedToUserId }
                    : {}),
                }
              : c
          )
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: invalidate,
  });

  const resolve = useMutation({
    mutationFn: (id: string) => resolveComment(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Comment[]>(key);
      if (prev) {
        qc.setQueryData<Comment[]>(
          key,
          prev.map((c) =>
            c.id === id
              ? { ...c, resolved: true, resolved_at: new Date().toISOString() }
              : c
          )
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: invalidate,
  });

  const reopen = useMutation({
    mutationFn: (id: string) => reopenComment(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Comment[]>(key);
      if (prev) {
        qc.setQueryData<Comment[]>(
          key,
          prev.map((c) =>
            c.id === id
              ? {
                  ...c,
                  resolved: false,
                  resolved_at: null,
                  resolved_by_user_id: null,
                }
              : c
          )
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteComment(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Comment[]>(key);
      if (prev) {
        qc.setQueryData<Comment[]>(
          key,
          prev.filter((c) => c.id !== id)
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: invalidate,
  });

  return { create, update, resolve, reopen, remove };
}
