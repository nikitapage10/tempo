"use client";

import { InfiniteData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchConversations,
  fetchMessages,
  fetchUnreadDmCount,
  deleteMessage,
  editMessage,
  markConversationUnread,
  markConversationRead,
  searchConversationMessages,
  setConversationMuted,
  setConversationArchived,
  sendMessage,
  startDirectConversation,
  toggleMessagePin,
  toggleMessageReaction,
  toggleSceneMessageReaction,
} from "@/lib/api/messages";
import { deleteSupportMessage, editSupportMessage, fetchSupportMessages, fetchSupportThreads, replyToSupportThread, setSupportThreadState } from "@/lib/api/support-messages";
import type { ConversationMessage, MessageAttachment } from "@/lib/types";

const MESSAGE_PAGE_SIZE = 50;

export function useConversationMessages(conversationId: string | null) {
  const query = useInfiniteQuery({
    queryKey: ["conversation-messages", conversationId],
    queryFn: ({ pageParam }) => fetchMessages(conversationId!, { before: pageParam ?? undefined, limit: MESSAGE_PAGE_SIZE }),
    initialPageParam: null as { createdAt: string; id: string } | null,
    enabled: !!conversationId,
    getNextPageParam: (page) => {
      if (page.length < MESSAGE_PAGE_SIZE) return undefined;
      const oldest = page[0];
      return oldest ? { createdAt: oldest.created_at, id: oldest.id } : undefined;
    },
    staleTime: 15_000,
  });
  const messages = query.data
    ? [...query.data.pages].reverse().flat()
    : [];
  return { ...query, messages };
}

export function useSupportThreads(archived = false) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["support-threads", archived], queryFn: () => fetchSupportThreads(archived), staleTime: 10_000, refetchInterval: 20_000 });
  const invalidate = () => Promise.all([
    qc.invalidateQueries({ queryKey: ["support-threads"] }),
    qc.invalidateQueries({ queryKey: ["support-messages"] }),
  ]);
  const reply = useMutation({ mutationFn: ({ id, body, media, replyToMessageId }: { id: string; body: string; media?: MessageAttachment[]; replyToMessageId?: string | null }) => replyToSupportThread(id, body, media, replyToMessageId), onSuccess: invalidate });
  const edit = useMutation({ mutationFn: ({ id, messageId, body }: { id: string; messageId: string; body: string }) => editSupportMessage(id, messageId, body), onSuccess: invalidate });
  const state = useMutation({ mutationFn: ({ id, ...input }: { id: string; archived?: boolean; read?: boolean }) => setSupportThreadState(id, input), onSuccess: invalidate });
  const removeMessage = useMutation({ mutationFn: ({ id, messageId }: { id: string; messageId: string }) => deleteSupportMessage(id, messageId), onSuccess: invalidate });
  return { ...query, reply, edit, state, removeMessage };
}

export function useSupportMessages(reportId: string | null) {
  const query = useInfiniteQuery({
    queryKey: ["support-messages", reportId],
    queryFn: ({ pageParam }) => fetchSupportMessages(reportId!, { before: pageParam ?? undefined }),
    initialPageParam: null as string | null,
    enabled: !!reportId,
    getNextPageParam: (page) => page.hasMore ? page.messages[0]?.created_at : undefined,
    staleTime: 15_000,
  });
  const messages = query.data ? [...query.data.pages].reverse().flatMap((page) => page.messages) : [];
  return { ...query, messages };
}

export function useSupportMessageSearch(reportId: string | null, queryText: string) {
  return useQuery({
    queryKey: ["support-message-search", reportId, queryText],
    queryFn: () => fetchSupportMessages(reportId!, { query: queryText }).then((page) => page.messages),
    enabled: !!reportId && queryText.trim().length >= 2,
    staleTime: 15_000,
  });
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
    mutationFn: (input: { conversationId: string; body: string; media?: MessageAttachment[]; replyToMessageId?: string | null; optimisticId?: string }) =>
      sendMessage({
        conversationId: input.conversationId,
        senderProfileId: myProfileId,
        senderScenePersonaId: myScenePersonaId,
        body: input.body,
        media: input.media,
        replyToMessageId: input.replyToMessageId,
      }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["conversation-messages", input.conversationId] });
      const key = ["conversation-messages", input.conversationId] as const;
      const previous = qc.getQueryData<InfiniteData<ConversationMessage[]>>(key);
      const optimisticId = input.optimisticId ?? `optimistic-${crypto.randomUUID()}`;
      const optimistic: ConversationMessage = {
        id: optimisticId,
        conversation_id: input.conversationId,
        sender_profile_id: myProfileId,
        sender_scene_persona_id: myScenePersonaId,
        sender_user_id: "current",
        body: input.body.trim(),
        media: input.media ?? [],
        reply_to_message_id: input.replyToMessageId ?? null,
        deleted_at: null,
        created_at: new Date().toISOString(),
        client_status: "sending",
      };
      if (previous?.pages.length) {
        const replacingFailed = previous.pages.some((page) => page.some((message) => message.id === optimisticId));
        qc.setQueryData<InfiniteData<ConversationMessage[]>>(key, {
          ...previous,
          pages: previous.pages.map((page, index) => replacingFailed
            ? page.map((message) => message.id === optimisticId ? optimistic : message)
            : index === 0 ? [...page, optimistic] : page),
        });
      } else {
        qc.setQueryData<InfiniteData<ConversationMessage[]>>(key, {
          pages: [[optimistic]],
          pageParams: [null],
        });
      }
      return { previous, optimisticId };
    },
    onError: (error, vars, context) => {
      const key = ["conversation-messages", vars.conversationId] as const;
      const current = qc.getQueryData<InfiniteData<ConversationMessage[]>>(key);
      if (!current || !context) return;
      qc.setQueryData<InfiniteData<ConversationMessage[]>>(key, {
        ...current,
        pages: current.pages.map((page) => page.map((message) => message.id === context.optimisticId
          ? { ...message, client_status: "failed", client_error: error instanceof Error ? error.message : "Send failed" }
          : message)),
      });
    },
    onSuccess: (saved, vars, context) => {
      const key = ["conversation-messages", vars.conversationId] as const;
      const current = qc.getQueryData<InfiniteData<ConversationMessage[]>>(key);
      if (current && context) {
        qc.setQueryData<InfiniteData<ConversationMessage[]>>(key, {
          ...current,
          pages: current.pages.map((page) => page.map((message) => message.id === context.optimisticId ? saved : message)),
        });
      }
      qc.invalidateQueries({ queryKey: ["messages", vars.conversationId] });
      qc.invalidateQueries({ queryKey: ["conversation-messages", vars.conversationId] });
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

  const invalidateMessageData = () => {
    qc.invalidateQueries({ queryKey: ["messages"] });
    qc.invalidateQueries({ queryKey: ["conversation-messages"] });
    qc.invalidateQueries({ queryKey: ["message-search"] });
    qc.invalidateQueries({ queryKey: ["conversations", myProfileId] });
  };
  const removeMessage = useMutation({ mutationFn: (message: ConversationMessage | string) => deleteMessage(message), onSuccess: invalidateMessageData });
  const edit = useMutation({ mutationFn: ({ messageId, body }: { messageId: string; body: string }) => editMessage(messageId, body), onSuccess: invalidateMessageData });
  const reaction = useMutation({ mutationFn: toggleMessageReaction, onSuccess: invalidateMessageData });
  const sceneReaction = useMutation({ mutationFn: toggleSceneMessageReaction, onSuccess: invalidateMessageData });
  const pin = useMutation({ mutationFn: (messageId: string) => toggleMessagePin(messageId), onSuccess: invalidateMessageData });
  const mute = useMutation({ mutationFn: ({ conversationId, muted }: { conversationId: string; muted: boolean }) => setConversationMuted(conversationId, muted), onSuccess: () => qc.invalidateQueries({ queryKey: ["conversations", myProfileId] }) });
  const markUnread = useMutation({ mutationFn: markConversationUnread, onSuccess: () => { qc.invalidateQueries({ queryKey: ["conversations", myProfileId] }); qc.invalidateQueries({ queryKey: ["dm-unread", myProfileId] }); } });
  const archive = useMutation({ mutationFn: ({ conversationId, archived }: { conversationId: string; archived: boolean }) => setConversationArchived(conversationId, archived), onSuccess: () => qc.invalidateQueries({ queryKey: ["conversations", myProfileId] }) });

  return { startDm, send, markRead, markUnread, removeMessage, edit, reaction, sceneReaction, pin, mute, archive };
}

export function useMessageSearch(conversationId: string | null, query: string) {
  return useQuery({
    queryKey: ["message-search", conversationId, query],
    queryFn: () => searchConversationMessages(conversationId!, query),
    enabled: !!conversationId && query.trim().length >= 2,
    staleTime: 15_000,
  });
}
