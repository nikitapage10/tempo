"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchConversations,
  fetchMessages,
  fetchUnreadDmCount,
  deleteMessage,
  markConversationRead,
  setConversationArchived,
  sendMessage,
  startDirectConversation,
} from "@/lib/api/messages";
import { deleteSupportMessage, fetchSupportThreads, replyToSupportThread, setSupportThreadState } from "@/lib/api/support-messages";
import type { MessageAttachment } from "@/lib/types";

export function useSupportThreads(archived = false) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["support-threads", archived], queryFn: () => fetchSupportThreads(archived), staleTime: 10_000, refetchInterval: 20_000 });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["support-threads"] });
  const reply = useMutation({ mutationFn: ({ id, body, media }: { id: string; body: string; media?: MessageAttachment[] }) => replyToSupportThread(id, body, media), onSuccess: invalidate });
  const state = useMutation({ mutationFn: ({ id, ...input }: { id: string; archived?: boolean; read?: boolean }) => setSupportThreadState(id, input), onSuccess: invalidate });
  const removeMessage = useMutation({ mutationFn: ({ id, messageId }: { id: string; messageId: string }) => deleteSupportMessage(id, messageId), onSuccess: invalidate });
  return { ...query, reply, state, removeMessage };
}

export function useConversations(myProfileId: string | null, archived = false) {
  return useQuery({
    queryKey: ["conversations", myProfileId, archived],
    queryFn: () => fetchConversations(myProfileId!, archived),
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

export function useMessageMutations(myProfileId: string | null, myScenePersonaId: string | null = null) {
  const qc = useQueryClient();

  const startDm = useMutation({
    mutationFn: (toProfileId: string) =>
      startDirectConversation(myProfileId!, toProfileId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations", myProfileId] });
    },
  });

  const send = useMutation({
    mutationFn: (input: { conversationId: string; body: string; media?: MessageAttachment[] }) =>
      sendMessage({
        conversationId: input.conversationId,
        senderProfileId: myProfileId,
        senderScenePersonaId: myScenePersonaId,
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

  const removeMessage = useMutation({ mutationFn: (message: import("@/lib/types").ConversationMessage | string) => deleteMessage(message), onSuccess: () => { qc.invalidateQueries({ queryKey: ["messages"] }); qc.invalidateQueries({ queryKey: ["conversations", myProfileId] }); } });
  const archive = useMutation({ mutationFn: ({ conversationId, archived }: { conversationId: string; archived: boolean }) => setConversationArchived(conversationId, archived), onSuccess: () => qc.invalidateQueries({ queryKey: ["conversations", myProfileId] }) });

  return { startDm, send, markRead, removeMessage, archive };
}
