import { createClient } from "@/lib/supabase/client";
import type { TaskStep } from "@/lib/types";

export async function fetchTaskSteps(taskId: string): Promise<TaskStep[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("task_steps")
    .select("*")
    .eq("task_id", taskId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createTaskStep(taskId: string, label: string, sortOrder: number): Promise<TaskStep> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("task_steps")
    .insert({ task_id: taskId, label: label.trim(), sort_order: sortOrder })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTaskStep(
  id: string,
  patch: Partial<Pick<TaskStep, "label" | "done" | "sort_order">>
): Promise<TaskStep> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("task_steps")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTaskStep(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("task_steps").delete().eq("id", id);
  if (error) throw error;
}

export async function reorderTaskSteps(steps: Array<{ id: string; sort_order: number }>): Promise<void> {
  const supabase = createClient();
  await Promise.all(
    steps.map((s) => supabase.from("task_steps").update({ sort_order: s.sort_order }).eq("id", s.id))
  );
}
