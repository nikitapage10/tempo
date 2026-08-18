"use client";

import * as React from "react";
import { ConversationTranscript } from "@/components/messages/conversation-transcript";
import { MessageBubble } from "@/components/messages/message-bubble";
import { MessageComposer } from "@/components/messages/message-composer";
import { EmptyShaderPanel } from "@/components/shader-empty";
import { useConversationRealtime } from "@/hooks/use-conversation-realtime";
import { useConversationMessages, useMessageMutations } from "@/hooks/use-messages";
import { useSessionConversationId } from "@/hooks/use-session-chat";
import { isMyMessage, messageAuthorLabel } from "@/lib/sessions/message-authorship";
import type { ConversationMessage, SessionRoomMember } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SessionChatPanel({
  roomId,
  myProfileId,
  myUserId,
  members,
  onPublished,
  chatTick,
}: {
  roomId: string;
  myProfileId: string | null;
  myUserId: string | null;
  members: SessionRoomMember[];
  onPublished?: () => void;
  chatTick?: number;
}) {
  const { data: conversationId, isLoading } = useSessionConversationId(roomId);
  const messageQuery = useConversationMessages(conversationId ?? null);
  const mutations = useMessageMutations(myProfileId);
  const realtime = useConversationRealtime({
    scope: "conversation",
    threadId: conversationId ?? null,
    typingLabel: "Someone",
  });
  const [replyTo, setReplyTo] = React.useState<ConversationMessage | null>(null);
  const byProfile = React.useMemo(
    () => new Map(members.map((member) => [member.profile_id, member])),
    [members]
  );

  React.useEffect(() => {
    if (chatTick) void messageQuery.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatTick]);

  if (isLoading) return <div className="h-full animate-pulse rounded-card bg-bg-2/40" />;
  if (!conversationId) {
    return <EmptyShaderPanel title="Chat is on the way" copy="This Session chat room hasn't been created yet." />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <ConversationTranscript
        messages={messageQuery.messages}
        hasOlder={messageQuery.hasNextPage}
        loadingOlder={messageQuery.isFetchingNextPage}
        loadOlder={messageQuery.fetchNextPage}
        peerTypingLabel={realtime.peerTypingLabel}
        bottomAnchored
        sentByMe={(message) => isMyMessage({ senderUserId: message.sender_user_id, currentUserId: myUserId })}
        renderMessage={(message) => {
          if (message.body.startsWith("::system::")) {
            return (
              <p className="px-3 text-center text-xs text-text-lo">
                {message.body.slice("::system::".length)}
              </p>
            );
          }
          const mine = isMyMessage({ senderUserId: message.sender_user_id, currentUserId: myUserId });
          const member = message.sender_profile_id ? byProfile.get(message.sender_profile_id) : undefined;
          const guest = Boolean(message.sender_session_guest_id || message.sender_guest_name);
          const author = messageAuthorLabel({
            guestName: message.sender_guest_name,
            profileName: member?.display_name,
          });
          return (
            <MessageBubble
              message={message}
              mine={mine}
              scope="direct"
              threadId={conversationId}
              authorLabel={guest ? `${author} · guest` : author}
              canPin
              onReply={setReplyTo}
              onEdit={(messageId, body) => mutations.edit.mutateAsync({ messageId, body })}
              onDelete={(item) => mutations.removeMessage.mutateAsync(item)}
              onReact={(item, emoji) => mutations.reaction.mutateAsync({ messageId: item.id, profileId: myProfileId!, emoji })}
              onPin={(item) => mutations.pin.mutateAsync(item.id)}
              onRetry={(item) =>
                mutations.send.mutateAsync({
                  conversationId,
                  body: item.body,
                  media: item.media.filter((media): media is import("@/lib/types").MessageAttachment => typeof media !== "string"),
                  replyToMessageId: item.reply_to_message_id,
                  optimisticId: item.id,
                })
              }
            />
          );
        }}
      />
      <div className={cn("shrink-0 border-t border-line p-3")}>
        <MessageComposer
          scope="direct"
          threadId={conversationId}
          draftKey={`session:${conversationId}`}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onTyping={realtime.sendTyping}
          pending={mutations.send.isPending}
          placeholder="Message the Session..."
          onSend={async ({ body, media, replyToMessageId }) => {
            await mutations.send.mutateAsync({ conversationId, body, media, replyToMessageId });
            onPublished?.();
          }}
        />
      </div>
    </div>
  );
}
