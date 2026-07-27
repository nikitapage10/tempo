import { createClient } from "@/lib/supabase/client";
import type { Task, TaskInsert, TaskUpdate } from "@/lib/types";

export async function fetchTasks(): Promise<Task[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createTask(input: TaskInsert): Promise<Task> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title: input.title.trim(),
      category: input.category ?? "other",
      status: input.status ?? "todo",
      due_date: input.due_date || null,
      notes: input.notes?.trim() || null,
      track_id: input.track_id ?? null,
      project_id: input.project_id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTask(id: string, patch: TaskUpdate): Promise<Task> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({
      ...patch,
      due_date: patch.due_date === "" ? null : patch.due_date,
      notes:
        patch.notes === undefined ? undefined : patch.notes?.trim() || null,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTask(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

export async function countTasksDueThisWeek(): Promise<number> {
  const supabase = createClient();
  const now = new Date();
  const day = (now.getDay() + 6) % 7;
  const start = new Date(now);
  start.setDate(now.getDate() - day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  const { count, error } = await supabase
    .from("tasks")
    .select("*", { count: "exact", head: true })
    .neq("status", "done")
    .gte("due_date", startStr)
    .lt("due_date", endStr);
  if (error) throw error;
  return count ?? 0;
}
