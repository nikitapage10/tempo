"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";

type RealtimeNotification = { type?: string; title?: string; link_url?: string | null };
const memberMessageTypes = new Set(["dm_message", "support_reply"]);
const adminMessageTypes = new Set(["support_member_reply", "support_new"]);

export function useRealtimeInbox(admin = false) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  React.useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || cancelled) return;
      channel = supabase
        .channel(`tempo-inbox-${user.id}-${crypto.randomUUID()}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (payload) => {
          const notification = payload.new as RealtimeNotification;
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
    });

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [admin, queryClient, toast]);
}
