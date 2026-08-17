"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTaskStep,
  deleteTaskStep,
  fetchTaskSteps,
  reorderTaskSteps,
  updateTaskStep,
} from "@/lib/api/task-steps";
import type { TaskStep } from "@/lib/types";

export function useTaskSteps(taskId: string | null) {
  return useQuery({
    queryKey: ["task-steps", taskId],
    queryFn: () => fetchTaskSteps(taskId as string),
    enabled: !!taskId,
  });
}

export function useTaskStepMutations(taskId: string | null) {
  const qc = useQueryClient();
  const key = ["task-steps", taskId] as const;
  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const create = useMutation({
    mutationFn: ({ label, sortOrder }: { label: string; sortOrder: number }) =>
      createTaskStep(taskId as string, label, sortOrder),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Pick<TaskStep, "label" | "done" | "sort_order">> }) =>
      updateTaskStep(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<TaskStep[]>(key);
      if (prev) {
        qc.setQueryData<TaskStep[]>(
          key,
          prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
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
    mutationFn: (id: string) => deleteTaskStep(id),
    onSuccess: invalidate,
  });

  const reorder = useMutation({
    mutationFn: (steps: Array<{ id: string; sort_order: number }>) => reorderTaskSteps(steps),
    onSuccess: invalidate,
  });

  return { create, update, remove, reorder };
}
