import { createClient } from "@/lib/supabase/client";

export type DigestFrequency = "off" | "daily" | "weekly";

export type NotificationPreferences = {
  user_id: string;
  timezone: string;
  email_pulse_enabled: boolean;
  digest_frequency: DigestFrequency;
  delivery_local_time: string;
  weekly_delivery_day: number | null;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  paused_until: string | null;
  include_entity_names: boolean;
  immediate_guest_feedback: boolean;
  immediate_collaboration: boolean;
  immediate_message_awareness: boolean;
  category_due: boolean;
  category_attention: boolean;
  category_feedback: boolean;
  category_collaboration: boolean;
  category_messages: boolean;
  category_calendar: boolean;
  category_progress: boolean;
};

export const browserTimezone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export async function fetchNotificationPreferences(): Promise<NotificationPreferences | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Only the columns present in `patch` are written — PostgREST upsert leaves
 * every other column untouched on conflict. Never pass `timezone` here
 * unless the member is actually changing it; ensureNotificationPreferences
 * below is the one place that seeds it (browser default) on first creation.
 */
export async function updateNotificationPreferences(
  patch: Partial<Omit<NotificationPreferences, "user_id">>
): Promise<NotificationPreferences> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("You’re signed out — sign in again, then retry.");

  const { data, error } = await supabase
    .from("notification_preferences")
    .upsert({ user_id: userData.user.id, ...patch }, { onConflict: "user_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Ensures a row exists, seeding the browser's timezone only on first creation. */
export async function ensureNotificationPreferences(): Promise<NotificationPreferences> {
  const existing = await fetchNotificationPreferences();
  if (existing) return existing;
  return updateNotificationPreferences({ timezone: browserTimezone() });
}
