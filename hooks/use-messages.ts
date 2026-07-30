"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchConversations,
  fetchMessages,
  fetchUnreadDmCount,
  markConversationRead,
  sendMessage,
  startDirectConversation,
} from "@/lib/api/messages";

export function useConversations(myProfileId: string | null) {
  return useQuery({
    queryKey: ["conversations", myProfileId],
    queryFn: () => fetchConversations(myProfileId!),
    enabled: !!myProfileId,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => fetchMessages(conversationId!),
    enabled: !!conversationId,
    refetchInterval: 8_000,
  });
}

export function useUnreadDmCount(myProfileId: string | null) {
  return useQuery({
    queryKey: ["dm-unread", myProfileId],
    queryFn: () => fetchUnreadDmCount(myProfileId!),
    enabled: !!myProfileId,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

export function useMessageMutations(myProfileId: string | null) {
  const qc = useQueryClient();

  const startDm = useMutation({
    mutationFn: (toProfileId: string) =>
      startDirectConversation(myProfileId!, toProfileId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations", myProfileId] });
    },
  });

  const send = useMutation({
    mutationFn: (input: { conversationId: string; body: string; media?: string[] }) =>
      sendMessage({
        conversationId: input.conversationId,
        senderProfileId: myProfileId!,
        body: input.body,
        media: input.media,
      }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["messages", vars.conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations", myProfileId] });
    },
  });

  const markRead = useMutation({
    mutationFn: (conversationId: string) => markConversationRead(conversationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations", myProfileId] });
      qc.invalidateQueries({ queryKey: ["dm-unread", myProfileId] });
    },
  });

  return { startDm, send, markRead };
}
