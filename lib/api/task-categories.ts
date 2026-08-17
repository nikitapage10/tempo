import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_TASK_CATEGORIES,
  mergeTaskCategories,
  normalizeTaskCategoryColor,
  type TaskCategoryDefinition,
} from "@/lib/tasks/categories";

export type TaskCategoriesResult = {
  categories: TaskCategoryDefinition[];
  customizable: boolean;
};

function schemaMissing(error: { code?: string; message?: string }) {
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    error.message?.includes("task_categories") === true
  );
}

export async function fetchTaskCategories(
  artistId: string
): Promise<TaskCategoriesResult> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("task_categories")
    .select("key,label,color,sort_order")
    .eq("artist_id", artistId);
  if (error && schemaMissing(error)) {
    return { categories: DEFAULT_TASK_CATEGORIES, customizable: false };
  }
  if (error) throw error;
  const saved: TaskCategoryDefinition[] = (data ?? []).map((row) => ({
    key: row.key,
    label: row.label,
    color: normalizeTaskCategoryColor(row.color),
    sort: Number(row.sort_order ?? 0),
    locked: DEFAULT_TASK_CATEGORIES.some((category) => category.key === row.key),
  }));
  return { categories: mergeTaskCategories(saved), customizable: true };
}

export async function saveTaskCategory(
  artistId: string,
  category: TaskCategoryDefinition
) {
  const supabase = createClient();
  const { error } = await supabase.from("task_categories").upsert(
    {
      artist_id: artistId,
      key: category.key,
      label: category.label.trim().slice(0, 40),
      color: normalizeTaskCategoryColor(category.color),
      sort_order: category.sort,
    },
    { onConflict: "artist_id,key" }
  );
  if (error) throw error;
}

export async function deleteTaskCategory(artistId: string, key: string) {
  if (DEFAULT_TASK_CATEGORIES.some((category) => category.key === key)) {
    throw new Error("Built-in categories can be renamed or recolored, but not removed.");
  }
  const supabase = createClient();
  const { data: spaces, error: spacesError } = await supabase
    .from("spaces")
    .select("id")
    .eq("artist_id", artistId);
  if (spacesError) throw spacesError;
  const spaceIds = (spaces ?? []).map((space) => space.id);
  if (spaceIds.length > 0) {
    const { error: tasksError } = await supabase
      .from("tasks")
      .update({ category: "other" })
      .eq("category", key)
      .in("space_id", spaceIds);
    if (tasksError) throw tasksError;
  }
  const { error } = await supabase
    .from("task_categories")
    .delete()
    .eq("artist_id", artistId)
    .eq("key", key);
  if (error) throw error;
}
