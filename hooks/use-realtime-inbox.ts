"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { isDirectMessageSignal } from "@/lib/notifications/visibility";
import { createClient } from "@/lib/supabase/client";

type RealtimeNotification = { type?: string; title?: string; link_url?: string | null };
const memberMessageTypes = new Set(["support_reply"]);
const adminMessageTypes = new Set(["support_member_reply", "support_new"]);

export function useRealtimeInbox(admin = false) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  // Shares the one `auth.getUser()` the app already makes, rather than asking
  // the auth server who we are a second time on every page load.
  const currentUser = useCurrentUser();
  const userId = currentUser?.id ?? null;

  React.useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`tempo-inbox-${userId}-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (payload) => {
        const notification = payload.new as RealtimeNotification;
        if (isDirectMessageSignal(notification.type)) {
          // A DM belongs exclusively to Messages. Use this internal row to
          // refresh its thread and unread badge, but do not touch the bell or
          // raise a second toast notification.
          void queryClient.invalidateQueries({ queryKey: ["messages"] });
          void queryClient.invalidateQueries({ queryKey: ["conversations"] });
          void queryClient.invalidateQueries({ queryKey: ["dm-unread"] });
          void queryClient.invalidateQueries({ queryKey: ["pulse-items"] });
          return;
        }

        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
        void queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
        if (memberMessageTypes.has(notification.type ?? "")) {
          void queryClient.invalidateQueries({ queryKey: ["messages"] });
          void queryClient.invalidateQueries({ queryKey: ["conversations"] });
          void queryClient.invalidateQueries({ queryKey: ["dm-unread"] });
          void queryClient.invalidateQueries({ queryKey: ["support-threads"] });
        }
        if (admin && adminMessageTypes.has(notification.type ?? "")) {
          void queryClient.invalidateQueries({ queryKey: ["admin", "support"] });
          void queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
        }
        const isInboxEvent = memberMessageTypes.has(notification.type ?? "") || (admin && adminMessageTypes.has(notification.type ?? ""));
        if (isInboxEvent) toast(notification.title ?? "New message", "info", notification.link_url ? { label: "Open", onClick: () => window.location.assign(notification.link_url!) } : undefined);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [admin, queryClient, toast, userId]);
}
