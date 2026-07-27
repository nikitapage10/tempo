import { createClient } from "@/lib/supabase/client";
import type { ReferenceKind, TrackReference } from "@/lib/types";

export async function fetchReferences(trackId: string): Promise<TrackReference[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("track_references")
    .select("*")
    .eq("track_id", trackId)
    .order("sort", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export type CreateReferenceInput = {
  trackId: string;
  kind: ReferenceKind;
  title: string;
  url?: string | null;
  assetId?: string | null;
  note?: string | null;
  startSec?: number | null;
  endSec?: number | null;
  intent?: string | null;
  sort?: number;
};

export async function createReference(
  input: CreateReferenceInput
): Promise<TrackReference> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("track_references")
    .insert({
      track_id: input.trackId,
      kind: input.kind,
      title: input.title.trim(),
      url: input.url?.trim() || null,
      asset_id: input.assetId ?? null,
      note: input.note?.trim() || null,
      start_sec: input.startSec ?? null,
      end_sec: input.endSec ?? null,
      intent: input.intent?.trim() || null,
      sort: input.sort ?? 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export type UpdateReferenceInput = Partial<{
  title: string;
  url: string | null;
  note: string | null;
  startSec: number | null;
  endSec: number | null;
  intent: string | null;
}>;

export async function updateReference(
  id: string,
  patch: UpdateReferenceInput
): Promise<TrackReference> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("track_references")
    .update({
      ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
      ...(patch.url !== undefined ? { url: patch.url?.trim() || null } : {}),
      ...(patch.note !== undefined ? { note: patch.note?.trim() || null } : {}),
      ...(patch.startSec !== undefined ? { start_sec: patch.startSec } : {}),
      ...(patch.endSec !== undefined ? { end_sec: patch.endSec } : {}),
      ...(patch.intent !== undefined
        ? { intent: patch.intent?.trim() || null }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteReference(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("track_references").delete().eq("id", id);
  if (error) throw error;
}

export async function reorderReferences(
  ordered: { id: string; sort: number }[]
): Promise<void> {
  const supabase = createClient();
  const results = await Promise.all(
    ordered.map(({ id, sort }) =>
      supabase.from("track_references").update({ sort }).eq("id", id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}
