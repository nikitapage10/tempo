"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  countTracksInStage,
  createStage,
  deleteStage,
  fetchStages,
  renameStage,
  reorderStages,
} from "@/lib/api/stages";
import type { Stage } from "@/lib/types";

export function useStages(spaceId: string | null) {
  return useQuery({
    queryKey: ["stages", spaceId],
    queryFn: () => fetchStages(spaceId!),
    enabled: !!spaceId,
  });
}

export function useStageMutations(spaceId: string | null) {
  const qc = useQueryClient();
  const key = ["stages", spaceId] as const;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["tracks", spaceId] });
  };

  const create = useMutation({
    mutationFn: ({ name, sort }: { name: string; sort: number }) =>
      createStage(spaceId!, name, sort),
    onSuccess: invalidate,
  });

  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      renameStage(id, name),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: ({
      stageId,
      moveTo,
    }: {
      stageId: string;
      moveTo: string | null;
    }) => deleteStage(stageId, moveTo),
    onSuccess: invalidate,
  });

  const reorder = useMutation({
    mutationFn: (ordered: { id: string; sort: number }[]) =>
      reorderStages(ordered),
    onMutate: async (ordered) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Stage[]>(key);
      if (prev) {
        const byId = new Map(ordered.map((o) => [o.id, o.sort]));
        qc.setQueryData<Stage[]>(
          key,
          [...prev]
            .map((s) => ({ ...s, sort: byId.get(s.id) ?? s.sort }))
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

  return { create, rename, remove, reorder, countTracksInStage };
}
