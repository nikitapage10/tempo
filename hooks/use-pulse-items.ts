import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { notificationBreadth } from "@/lib/notifications/href";
import { buildInAppPulse, type RawPulseItem } from "@/lib/pulse/normalize";
import type { AppNotification } from "@/lib/types";

/**
 * In-app Pulse source, scoped to global message/support awareness — the
 * one category guaranteed not to duplicate anything Today already shows
 * (Tasks due / Needs attention are track/task-scoped, never messages).
 * Deliberately narrow for AR-5's first ship: the normalization primitives
 * in lib/pulse/normalize.ts are written to support every category in
 * 01-PRODUCT-AND-UX-SPEC.md §8.2 once AR-6/AR-7 add their sources.
 */
async function fetchPulseItems(): Promise<RawPulseItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, entity_type, entity_id, link_url, track_id, read_at, created_at")
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return [];

  const messages = (data ?? []).filter(
    (n) => notificationBreadth(n as AppNotification) === "messages"
  );
  if (messages.length === 0) return [];

  return [
    {
      dedupeIdentity: "pulse:unread-messages",
      category: "messages",
      urgency: "awareness",
      occurredAt: messages[0].created_at,
      genericLabel:
        messages.length === 1
          ? "1 new message"
          : `${messages.length} new messages`,
      count: messages.length,
      reasonCode: "unread_messages",
      destination: "/messages",
      sensitivity: "never_email",
    },
  ];
}

export function usePulseModule() {
  const query = useQuery({ queryKey: ["pulse-items"], queryFn: fetchPulseItems });
  const result = buildInAppPulse(query.data ?? [], new Set());
  return { ...result, isLoading: query.isLoading };
}
