"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteTaskCategory,
  fetchTaskCategories,
  saveTaskCategory,
} from "@/lib/api/task-categories";
import type { TaskCategoryDefinition } from "@/lib/tasks/categories";

export function useTaskCategories(artistId: string | null) {
  return useQuery({
    queryKey: ["task-categories", artistId],
    queryFn: () => fetchTaskCategories(artistId!),
    enabled: !!artistId,
    staleTime: 60_000,
  });
}

export function useTaskCategoryMutations(artistId: string | null) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["task-categories", artistId] });
  const save = useMutation({
    mutationFn: (category: TaskCategoryDefinition) => {
      if (!artistId) throw new Error("Choose a workspace first.");
      return saveTaskCategory(artistId, category);
    },
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (key: string) => {
      if (!artistId) throw new Error("Choose a workspace first.");
      return deleteTaskCategory(artistId, key);
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
  return { save, remove };
}
