import { createClient } from "@/lib/supabase/client";
import { recordProductEvent } from "@/lib/product-events/client";
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

/** Quick log — a one-shot note with no start/end timing, always "completed". */
export async function createSession(input: {
  trackId: string;
  note: string;
  versionId?: string | null;
}): Promise<Session> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      track_id: input.trackId,
      user_id: userData.user?.id ?? null,
      note: input.note.trim(),
      version_id: input.versionId ?? null,
      status: "completed",
      started_at: now,
      ended_at: now,
      logged_at: now,
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

/** The signed-in user's in-progress focus session, if any (at most one, enforced by DB). */
export async function fetchActiveSession(): Promise<Session | null> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", userData.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type StartFocusSessionInput = {
  trackId: string;
  goal?: string | null;
  versionId?: string | null;
};

export async function startFocusSession(
  input: StartFocusSessionInput
): Promise<Session> {
  const supabase = createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) {
    throw new Error("You’re signed out — sign in again, then retry.");
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      track_id: input.trackId,
      user_id: userData.user.id,
      version_id: input.versionId ?? null,
      note: "",
      logged_at: now,
      status: "active",
      goal: input.goal?.trim() || null,
      started_at: now,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error(
        "You already have a focus session running — end or abandon it before starting another."
      );
    }
    throw error;
  }
  recordProductEvent(
    "focus_session_started",
    { source_surface: "track", has_goal: Boolean(input.goal?.trim()) }
  );
  return data;
}

function computeElapsedSec(startedAt: string | null): number {
  const start = startedAt ? new Date(startedAt).getTime() : Date.now();
  return Math.max(0, Math.round((Date.now() - start) / 1000));
}

export type EndFocusSessionInput = {
  note: string;
  outcome?: string | null;
  nextActionAfter?: string | null;
  /** Links the session to a bounce uploaded (or picked) while wrapping up. */
  versionId?: string | null;
};

/** Ends an active focus session, computing elapsed_sec from started_at. */
export async function endFocusSession(
  sessionId: string,
  input: EndFocusSessionInput
): Promise<Session> {
  const supabase = createClient();
  const { data: existing, error: fetchError } = await supabase
    .from("sessions")
    .select("started_at")
    .eq("id", sessionId)
    .single();
  if (fetchError) throw fetchError;

  const endedAt = new Date().toISOString();
  const elapsedSec = computeElapsedSec(existing.started_at);
  const { data, error } = await supabase
    .from("sessions")
    .update({
      status: "completed",
      note: input.note.trim(),
      outcome: input.outcome?.trim() || null,
      next_action_after: input.nextActionAfter?.trim() || null,
      ...(input.versionId !== undefined ? { version_id: input.versionId } : {}),
      ended_at: endedAt,
      elapsed_sec: elapsedSec,
      logged_at: endedAt,
    })
    .eq("id", sessionId)
    .select()
    .single();
  if (error) throw error;
  recordProductEvent("focus_session_completed", {
    duration_bucket: durationBucket(elapsedSec),
    next_move_updated: Boolean(input.nextActionAfter?.trim()),
    bounce_uploaded: Boolean(input.versionId),
  });
  return data;
}

function durationBucket(seconds: number): string {
  const minutes = seconds / 60;
  if (minutes < 15) return "under_15m";
  if (minutes < 30) return "15_30m";
  if (minutes < 60) return "30_60m";
  return "over_60m";
}

/** Ends an active focus session without keeping any notes (discarded). */
export async function abandonSession(sessionId: string): Promise<Session> {
  const supabase = createClient();
  const { data: existing, error: fetchError } = await supabase
    .from("sessions")
    .select("started_at")
    .eq("id", sessionId)
    .single();
  if (fetchError) throw fetchError;

  const endedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("sessions")
    .update({
      status: "abandoned",
      ended_at: endedAt,
      elapsed_sec: computeElapsedSec(existing.started_at),
      logged_at: endedAt,
    })
    .eq("id", sessionId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export type WeeklyElapsedSummary = {
  totalSec: number;
  sessionCount: number;
  byTrack: { trackId: string; totalSec: number }[];
};

/** Focus time logged since local Monday 00:00, for the signed-in user. */
export async function weeklyElapsed(): Promise<WeeklyElapsedSummary> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { totalSec: 0, sessionCount: 0, byTrack: [] };

  const now = new Date();
  const day = (now.getDay() + 6) % 7; // Mon=0
  const start = new Date(now);
  start.setDate(now.getDate() - day);
  start.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("sessions")
    .select("track_id, elapsed_sec, status")
    .eq("user_id", userData.user.id)
    .neq("status", "active")
    .gte("logged_at", start.toISOString());
  if (error) throw error;

  const rows = data ?? [];
  const byTrackMap = new Map<string, number>();
  let totalSec = 0;
  for (const row of rows) {
    const sec = row.elapsed_sec ?? 0;
    totalSec += sec;
    byTrackMap.set(row.track_id, (byTrackMap.get(row.track_id) ?? 0) + sec);
  }

  return {
    totalSec,
    sessionCount: rows.length,
    byTrack: Array.from(byTrackMap.entries()).map(([trackId, secs]) => ({
      trackId,
      totalSec: secs,
    })),
  };
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
