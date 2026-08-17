"use client";

import * as React from "react";
import { useTaskCategories } from "@/hooks/use-task-categories";
import {
  DEFAULT_TASK_CATEGORIES,
  type TaskCategoryDefinition,
} from "@/lib/tasks/categories";

type TaskCategoryContextValue = {
  artistId: string | null;
  categories: TaskCategoryDefinition[];
  customizable: boolean;
};

const TaskCategoryContext = React.createContext<TaskCategoryContextValue>({
  artistId: null,
  categories: DEFAULT_TASK_CATEGORIES,
  customizable: false,
});

export function TaskCategoryProvider({
  artistId,
  children,
}: {
  artistId: string | null;
  children: React.ReactNode;
}) {
  const query = useTaskCategories(artistId);
  return (
    <TaskCategoryContext.Provider
      value={{
        artistId,
        categories: query.data?.categories ?? DEFAULT_TASK_CATEGORIES,
        customizable: query.data?.customizable ?? false,
      }}
    >
      {children}
    </TaskCategoryContext.Provider>
  );
}

export function useTaskCategoryPalette() {
  return React.useContext(TaskCategoryContext);
}
