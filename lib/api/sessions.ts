import { createClient } from "@/lib/supabase/client";
import type { Session } from "@/lib/types";

export async function fetchSessions(trackId: string): Promise<Session[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("track_id", trackId)
    .order("logged_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createSession(input: {
  trackId: string;
  note: string;
  versionId?: string | null;
}): Promise<Session> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      track_id: input.trackId,
      note: input.note.trim(),
      version_id: input.versionId ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSession(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("sessions").delete().eq("id", id);
  if (error) throw error;
}

/** Count sessions logged since local Monday 00:00. */
export async function countSessionsThisWeek(): Promise<number> {
  const supabase = createClient();
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // Mon=0
  const start = new Date(now);
  start.setDate(now.getDate() - day);
  start.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from("sessions")
    .select("*", { count: "exact", head: true })
    .gte("logged_at", start.toISOString());
  if (error) throw error;
  return count ?? 0;
}
