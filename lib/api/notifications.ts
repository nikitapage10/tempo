import { createClient } from "@/lib/supabase/client";
import {
  DIRECT_MESSAGE_SIGNAL_TYPE,
  isDirectMessageSignal,
} from "@/lib/notifications/visibility";
import type { AppNotification } from "@/lib/types";

export async function fetchNotifications(limit = 50): Promise<AppNotification[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .neq("type", DIRECT_MESSAGE_SIGNAL_TYPE)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  // Keep a client-side guard too, so cached or mocked responses cannot put a
  // direct-message signal back into the bell UI.
  return (data ?? []).filter((item) => !isDirectMessageSignal(item.type));
}

export async function countUnreadNotifications(): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .neq("type", DIRECT_MESSAGE_SIGNAL_TYPE)
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

export type CreateNotificationInput = {
  userId: string;
  trackId?: string | null;
  type: string;
  title: string;
  body?: string | null;
};

export async function createNotification(
  input: CreateNotificationInput
): Promise<AppNotification> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("notifications")
    .insert({
      user_id: input.userId,
      track_id: input.trackId ?? null,
      type: input.type,
      title: input.title,
      body: input.body?.trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markRead(id: string): Promise<AppNotification> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markAllRead(): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .neq("type", DIRECT_MESSAGE_SIGNAL_TYPE)
    .is("read_at", null);
  if (error) throw error;
}

export async function deleteNotification(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("notifications").delete().eq("id", id);
  if (error) throw error;
}
