"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/use-current-user";
import { createClient } from "@/lib/supabase/client";
import { typingExpiry } from "@/lib/messages/behavior";

type TypingPayload = {
  userId: string;
  label?: string;
  typing: boolean;
  expiresAt: number;
};

/** Private, ephemeral conversation activity. No presence or read state is stored. */
export function useConversationRealtime(input: {
  scope: "conversation" | "support";
  threadId: string | null;
  typingLabel?: string;
}) {
  const { scope, threadId, typingLabel } = input;
  const userId = useCurrentUser()?.id ?? null;
  const queryClient = useQueryClient();
  const channelRef = React.useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const lastTypingSentRef = React.useRef(0);
  const [typingLabelFromPeer, setTypingLabelFromPeer] = React.useState<string | null>(null);
  const expiryTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = React.useCallback(() => {
    if (!threadId) return;
    if (scope === "conversation") {
      void queryClient.invalidateQueries({ queryKey: ["conversation-messages", threadId] });
      void queryClient.invalidateQueries({ queryKey: ["messages", threadId] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } else {
      void queryClient.invalidateQueries({ queryKey: ["support-threads"] });
      void queryClient.invalidateQueries({ queryKey: ["support-messages", threadId] });
    }
  }, [queryClient, scope, threadId]);

  React.useEffect(() => {
    if (!threadId || !userId) return;
    const supabase = createClient();
    const topic = `${scope}:${threadId}`;
    let active = true;
    void supabase.realtime.setAuth();
    const channel = supabase
      .channel(topic, { config: { private: true, broadcast: { ack: true } } })
      .on("broadcast", { event: "message-change" }, refresh)
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const next = payload as TypingPayload;
        if (!active || next.userId === userId) return;
        if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
        if (!next.typing || next.expiresAt <= Date.now()) {
          setTypingLabelFromPeer(null);
          return;
        }
        setTypingLabelFromPeer(next.label || "Someone");
        expiryTimerRef.current = setTimeout(
          () => setTypingLabelFromPeer(null),
          Math.max(0, next.expiresAt - Date.now()),
        );
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") refresh();
      });
    channelRef.current = channel;
    return () => {
      active = false;
      if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
      setTypingLabelFromPeer(null);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [refresh, scope, threadId, userId]);

  const sendTyping = React.useCallback((typing: boolean) => {
    if (!channelRef.current || !userId) return;
    const now = Date.now();
    if (typing && now - lastTypingSentRef.current < 1_500) return;
    lastTypingSentRef.current = now;
    void channelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: {
        userId,
        label: typingLabel,
        typing,
        expiresAt: typing ? typingExpiry(now) : now,
      } satisfies TypingPayload,
    });
  }, [typingLabel, userId]);

  return { peerTypingLabel: typingLabelFromPeer, sendTyping, refresh };
}
