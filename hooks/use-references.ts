"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createReference,
  deleteReference,
  fetchReferences,
  reorderReferences,
  updateReference,
  type CreateReferenceInput,
  type UpdateReferenceInput,
} from "@/lib/api/references";
import type { TrackReference } from "@/lib/types";

export function useReferences(trackId: string | null) {
  return useQuery({
    queryKey: ["references", trackId],
    queryFn: () => fetchReferences(trackId!),
    enabled: !!trackId,
  });
}

export function useReferenceMutations(trackId: string | null) {
  const qc = useQueryClient();
  const key = ["references", trackId] as const;

  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const create = useMutation({
    mutationFn: (input: Omit<CreateReferenceInput, "trackId">) => {
      const current = qc.getQueryData<TrackReference[]>(key) ?? [];
      const sort =
        current.length > 0 ? Math.max(...current.map((r) => r.sort)) + 1 : 0;
      return createReference({ ...input, trackId: trackId!, sort: input.sort ?? sort });
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateReferenceInput }) =>
      updateReference(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<TrackReference[]>(key);
      if (prev) {
        qc.setQueryData<TrackReference[]>(
          key,
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  ...(patch.title !== undefined ? { title: patch.title } : {}),
                  ...(patch.url !== undefined ? { url: patch.url } : {}),
                  ...(patch.note !== undefined ? { note: patch.note } : {}),
                  ...(patch.startSec !== undefined
                    ? { start_sec: patch.startSec }
                    : {}),
                  ...(patch.endSec !== undefined ? { end_sec: patch.endSec } : {}),
                  ...(patch.intent !== undefined ? { intent: patch.intent } : {}),
                }
              : r
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
    mutationFn: (id: string) => deleteReference(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<TrackReference[]>(key);
      if (prev) {
        qc.setQueryData<TrackReference[]>(
          key,
          prev.filter((r) => r.id !== id)
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: invalidate,
  });

  const reorder = useMutation({
    mutationFn: (ordered: { id: string; sort: number }[]) =>
      reorderReferences(ordered),
    onMutate: async (ordered) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<TrackReference[]>(key);
      if (prev) {
        const bySort = new Map(ordered.map((o) => [o.id, o.sort]));
        qc.setQueryData<TrackReference[]>(
          key,
          [...prev]
            .map((r) => ({ ...r, sort: bySort.get(r.id) ?? r.sort }))
            .sort((a, b) => a.sort - b.sort)
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: invalidate,
  });

  return { create, update, remove, reorder };
}
