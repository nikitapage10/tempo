"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTask,
  deleteTask,
  fetchTasks,
  updateTask,
} from "@/lib/api/tasks";
import type { Task, TaskInsert, TaskUpdate } from "@/lib/types";

export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: fetchTasks,
  });
}

export function useTaskMutations() {
  const qc = useQueryClient();
  const key = ["tasks"] as const;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["today-stats"] });
    qc.invalidateQueries({ queryKey: ["project-tasks"] });
  };

  const create = useMutation({
    mutationFn: (input: TaskInsert) => createTask(input),
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

  return { create, update, remove };
}
