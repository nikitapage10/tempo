import { createClient } from "@/lib/supabase/client";
import type { ActivityEvent } from "@/lib/types";

export async function fetchActivity(
  trackId: string,
  limit = 50
): Promise<ActivityEvent[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("activity_events")
    .select("*")
    .eq("track_id", trackId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    metadata: row.metadata ?? {},
  }));
}

export type LogActivityInput = {
  trackId: string;
  eventType: string;
  summary: string;
  entityType?: string | null;
  entityId?: string | null;
  actorLabel?: string | null;
  metadata?: Record<string, unknown>;
};

/** Logs one activity_events row. Best-effort by design — callers may fire-and-forget. */
export async function logActivity(input: LogActivityInput): Promise<ActivityEvent> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("activity_events")
    .insert({
      track_id: input.trackId,
      actor_user_id: userData.user?.id ?? null,
      actor_label: input.actorLabel ?? null,
      event_type: input.eventType,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      summary: input.summary,
      metadata: input.metadata ?? {},
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
