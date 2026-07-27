import { createClient } from "@/lib/supabase/client";
import type {
  ChecklistItem,
  ChecklistItemInsert,
  ChecklistItemUpdate,
  TemplateItem,
} from "@/lib/types";

export async function fetchChecklistItems(
  trackId: string
): Promise<ChecklistItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("checklist_items")
    .select("*")
    .eq("track_id", trackId)
    .order("sort", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createChecklistItem(
  input: ChecklistItemInsert
): Promise<ChecklistItem> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("checklist_items")
    .insert({
      track_id: input.track_id,
      text: input.text,
      done: input.done ?? false,
      sort: input.sort ?? 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateChecklistItem(
  id: string,
  patch: ChecklistItemUpdate
): Promise<ChecklistItem> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("checklist_items")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteChecklistItem(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("checklist_items")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function reorderChecklistItems(
  ordered: { id: string; sort: number }[]
): Promise<void> {
  const supabase = createClient();
  const results = await Promise.all(
    ordered.map(({ id, sort }) =>
      supabase.from("checklist_items").update({ sort }).eq("id", id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

/** Replace all checklist items on a track with template items (done = false). */
export async function applyTemplateToTrack(
  trackId: string,
  items: TemplateItem[]
): Promise<ChecklistItem[]> {
  const supabase = createClient();
  const { error: delError } = await supabase
    .from("checklist_items")
    .delete()
    .eq("track_id", trackId);
  if (delError) throw delError;

  if (items.length === 0) return [];

  const rows = items
    .slice()
    .sort((a, b) => a.sort - b.sort)
    .map((item, i) => ({
      track_id: trackId,
      text: item.text,
      done: false,
      sort: i,
    }));

  const { data, error } = await supabase
    .from("checklist_items")
    .insert(rows)
    .select()
    .order("sort", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
