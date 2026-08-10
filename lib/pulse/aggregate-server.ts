import type { SupabaseClient } from "@supabase/supabase-js";
import { notificationBreadth } from "@/lib/notifications/href";
import type { AppNotification } from "@/lib/types";
import type { RawPulseItem } from "./normalize";

/**
 * Server-side Pulse aggregation for a single user, re-authorized at
 * generation time (queries the user's own rows via the service-role
 * client, scoped by user_id — never trusts anything cached from schedule
 * time). Deliberately narrow for AR-6's first ship, matching AR-5's
 * in-app scope: unread message awareness only. Additional categories
 * (due/attention/feedback/collaboration/calendar) plug into the same
 * RawPulseItem shape in a later package without changing the scheduler,
 * renderer, or dedupe/suppression machinery.
 */
export async function aggregatePulseItemsForUser(
  admin: SupabaseClient,
  userId: string
): Promise<RawPulseItem[]> {
  const { data, error } = await admin
    .from("notifications")
    .select("id, type, entity_type, entity_id, link_url, track_id, read_at, created_at")
    .eq("user_id", userId)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error || !data) return [];

  const messages = data.filter((n) => notificationBreadth(n as AppNotification) === "messages");
  if (messages.length === 0) return [];

  return [
    {
      dedupeIdentity: "pulse:unread-messages",
      category: "messages",
      urgency: "awareness",
      occurredAt: messages[0].created_at,
      genericLabel: messages.length === 1 ? "1 new message" : `${messages.length} new messages`,
      count: messages.length,
      reasonCode: "unread_messages",
      destination: "/messages",
      sensitivity: "never_email",
    },
  ];
}
