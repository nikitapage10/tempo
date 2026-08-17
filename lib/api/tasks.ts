import { createClient } from "@/lib/supabase/client";
import { enqueue } from "@/lib/offline/outbox";
import type { Task, TaskInsert, TaskUpdate } from "@/lib/types";
import { assignArtistTask } from "@/lib/api/team-operations";

export { assignArtistTask };

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  return false;
}

export async function fetchTasks(spaceId: string | null): Promise<Task[]> {
  if (!spaceId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("space_id", spaceId)
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
      space_id: input.space_id ?? null,
      priority: input.priority ?? 0,
      reminder_minutes: input.reminder_minutes ?? [],
      recurrence: input.recurrence ?? null,
      recurrence_until: input.recurrence_until ?? null,
      recurrence_parent_id: input.recurrence_parent_id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Applies the same patch to several tasks at once, for the List view's bulk action bar. */
export async function bulkUpdateTasks(ids: string[], patch: TaskUpdate): Promise<void> {
  if (!ids.length) return;
  const supabase = createClient();
  const normalizedPatch = {
    ...patch,
    due_date: patch.due_date === "" ? null : patch.due_date,
  };
  const { error } = await supabase.from("tasks").update(normalizedPatch).in("id", ids);
  if (error) throw error;
}

export async function bulkDeleteTasks(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const supabase = createClient();
  const { error } = await supabase.from("tasks").delete().in("id", ids);
  if (error) throw error;
}

/**
 * Offline write (TEMPO Desktop Package 5) — the representative, actually
 * wired integration of lib/offline/outbox.ts. When there's no connection
 * (checked up front, or discovered mid-request), the edit is queued instead
 * of thrown as an error, so the optimistic update already applied by
 * useTaskMutations' onMutate (hooks/use-tasks.ts) sticks instead of being
 * rolled back — the whole point of "still works offline" for Tasks. See
 * planning/desktop/02 §6 for why this is a generic table-update descriptor
 * rather than a bespoke queue.
 */
export async function updateTask(id: string, patch: TaskUpdate): Promise<Task> {
  const normalizedPatch = {
    ...patch,
    due_date: patch.due_date === "" ? null : patch.due_date,
    notes: patch.notes === undefined ? undefined : patch.notes?.trim() || null,
  };

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await enqueue({ type: "supabase_update", table: "tasks", id, patch: normalizedPatch });
    return { id, ...normalizedPatch } as Task;
  }

  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from("tasks")
      .update(normalizedPatch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    if (isNetworkError(err)) {
      await enqueue({ type: "supabase_update", table: "tasks", id, patch: normalizedPatch });
      return { id, ...normalizedPatch } as Task;
    }
    throw err;
  }
}

export async function deleteTask(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

export async function countTasksDueThisWeek(
  spaceId: string | null
): Promise<number> {
  if (!spaceId) return 0;
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
    .eq("space_id", spaceId)
    .neq("status", "done")
    .gte("due_date", startStr)
    .lt("due_date", endStr);
  if (error) throw error;
  return count ?? 0;
}
