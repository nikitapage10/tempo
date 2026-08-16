"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTask,
  deleteTask,
  fetchTasks,
  updateTask,
  assignArtistTask,
} from "@/lib/api/tasks";
import type { Task, TaskInsert, TaskUpdate } from "@/lib/types";

export function useTasks(spaceId: string | null) {
  return useQuery({
    queryKey: ["tasks", spaceId],
    queryFn: () => fetchTasks(spaceId),
    enabled: !!spaceId,
  });
}

export function useTaskMutations(spaceId: string | null) {
  const qc = useQueryClient();
  const key = ["tasks", spaceId] as const;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["today-stats"] });
    qc.invalidateQueries({ queryKey: ["project-tasks"] });
    qc.invalidateQueries({ queryKey: ["calendar"] });
  };

  const create = useMutation({
    mutationFn: (input: TaskInsert) =>
      createTask({ ...input, space_id: input.space_id ?? spaceId }),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TaskUpdate }) =>
      updateTask(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Task[]>(key);
      if (prev) {
        qc.setQueryData<Task[]>(
          key,
          prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
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
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: invalidate,
  });

  const assign = useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string | null }) => assignArtistTask(id, userId),
    onSuccess: invalidate,
  });

  return { create, update, remove, assign };
}
