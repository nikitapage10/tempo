"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  applyTemplateToTrack,
  createChecklistItem,
  deleteChecklistItem,
  fetchChecklistItems,
  reorderChecklistItems,
  updateChecklistItem,
} from "@/lib/api/checklist";
import type {
  ChecklistItem,
  ChecklistItemUpdate,
  TemplateItem,
} from "@/lib/types";

export function useChecklist(trackId: string | null) {
  return useQuery({
    queryKey: ["checklist", trackId],
    queryFn: () => fetchChecklistItems(trackId!),
    enabled: !!trackId,
  });
}

export function useChecklistMutations(trackId: string | null) {
  const qc = useQueryClient();
  const key = ["checklist", trackId] as const;

  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const create = useMutation({
    mutationFn: (text: string) => {
      const current = qc.getQueryData<ChecklistItem[]>(key) ?? [];
      const sort =
        current.length > 0
          ? Math.max(...current.map((i) => i.sort)) + 1
          : 0;
      return createChecklistItem({ track_id: trackId!, text, sort });
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ChecklistItemUpdate }) =>
      updateChecklistItem(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<ChecklistItem[]>(key);
      if (prev) {
        qc.setQueryData<ChecklistItem[]>(
          key,
          prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
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
    mutationFn: (id: string) => deleteChecklistItem(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<ChecklistItem[]>(key);
      if (prev) {
        qc.setQueryData<ChecklistItem[]>(
          key,
          prev.filter((item) => item.id !== id)
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
      reorderChecklistItems(ordered),
    onMutate: async (ordered) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<ChecklistItem[]>(key);
      if (prev) {
        const byId = new Map(ordered.map((o) => [o.id, o.sort]));
        qc.setQueryData<ChecklistItem[]>(
          key,
          [...prev]
            .map((item) => ({
              ...item,
              sort: byId.get(item.id) ?? item.sort,
            }))
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

  const applyTemplate = useMutation({
    mutationFn: (items: TemplateItem[]) =>
      applyTemplateToTrack(trackId!, items),
    onSuccess: (data) => {
      qc.setQueryData(key, data);
    },
  });

  return { create, update, remove, reorder, applyTemplate };
}
