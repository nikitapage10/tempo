"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Files, Pin, Search, VolumeX } from "lucide-react";
import { ConversationTranscript } from "@/components/messages/conversation-transcript";
import { MessageAttachments } from "@/components/messages/message-attachments";
import { MessageBubble } from "@/components/messages/message-bubble";
import { MessageComposer } from "@/components/messages/message-composer";
import { EmptyShaderPanel } from "@/components/shader-empty";
import { useConversationRealtime } from "@/hooks/use-conversation-realtime";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useConversationMessages, useMessageMutations, useMessageSearch } from "@/hooks/use-messages";
import { useSceneConversationId } from "@/hooks/use-scene-chat";
import { useMyScenePersona, useSceneSections } from "@/hooks/use-scene-v2";
import type { ConversationMessage, SceneMember } from "@/lib/types";
import { cn } from "@/lib/utils";

type Utility = "search" | "pins" | "media" | null;

export function SceneChatPanel({ sceneId, myProfileId, myPersonaId = null, sectionId = null, members }: { sceneId: string; myProfileId: string | null; myPersonaId?: string | null; sectionId?: string | null; members: SceneMember[] }) {
  const searchParams = useSearchParams();
  const userId = useCurrentUser()?.id ?? null;
  const { data: sections = [] } = useSceneSections(sceneId);
  const { data: ownPersona } = useMyScenePersona(sceneId);
  const resolvedSectionId = sectionId ?? sections.find((section) => section.slug === searchParams.get("section") && section.type === "chat")?.id ?? null;
  const resolvedPersonaId = myPersonaId ?? ownPersona?.id ?? null;
  const { data: conversationId, isLoading: resolvingConversation } = useSceneConversationId(sceneId, resolvedSectionId);
  const messageQuery = useConversationMessages(conversationId ?? null);
  const messages = messageQuery.messages;
  const mutations = useMessageMutations(myProfileId, resolvedPersonaId);
  const realtime = useConversationRealtime({ scope: "conversation", threadId: conversationId ?? null, typingLabel: ownPersona?.display_name ?? "Someone" });
  const [replyTo, setReplyTo] = React.useState<ConversationMessage | null>(null);
  const [utility, setUtility] = React.useState<Utility>(null);
  const [query, setQuery] = React.useState("");
  const results = useMessageSearch(conversationId ?? null, query);
  const myMembership = members.find((member) => member.user_id === userId);
  const canPin = myMembership?.role === "owner" || myMembership?.role === "moderator";
  const byProfile = React.useMemo(() => new Map(members.map((member) => [member.profile_id, member.profile])), [members]);
  const byPersona = React.useMemo(() => new Map(members.filter((member) => member.persona).map((member) => [member.persona!.id, member.persona!])), [members]);

  if (resolvingConversation) return <div className="panel-quiet h-64 animate-pulse"/>;
  if (!conversationId) return <EmptyShaderPanel title="Chat is on the way" copy="This Scene chat room hasn't been created yet."/>;

  const utilityMessages = utility === "search" ? results.data ?? [] : utility === "pins" ? messages.filter((message) => message.pinned) : utility === "media" ? messages.filter((message) => message.media.length) : [];

  return <div className="panel flex h-[min(42rem,calc(100dvh-12rem))] min-h-[32rem] flex-col overflow-hidden">
    <header className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2"><p className="min-w-0 flex-1 text-sm font-medium text-text-hi">Scene chat</p><button type="button" onClick={() => setUtility(utility === "search" ? null : "search")} aria-label="Search messages" className="rounded-input p-2 text-text-lo hover:text-ice"><Search className="size-4"/></button><button type="button" onClick={() => setUtility(utility === "pins" ? null : "pins")} aria-label="Pinned messages" className="rounded-input p-2 text-text-lo hover:text-ice"><Pin className="size-4"/></button><button type="button" onClick={() => setUtility(utility === "media" ? null : "media")} aria-label="Shared media" className="rounded-input p-2 text-text-lo hover:text-ice"><Files className="size-4"/></button><button type="button" onClick={() => mutations.mute.mutate({ conversationId, muted: !myMembership?.muted })} aria-label="Mute Scene chat" className="rounded-input p-2 text-text-lo hover:text-ice"><VolumeX className="size-4"/></button><button type="button" onClick={() => mutations.markUnread.mutate(conversationId)} className="rounded-input px-2 py-1.5 text-xs text-text-lo hover:text-ice">Mark unread</button></header>
    {utility ? <div className="max-h-44 shrink-0 overflow-y-auto border-b border-line bg-bg-1/80 p-3">{utility === "search" ? <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this Scene chat" className="mb-2 w-full rounded-input border border-line bg-bg-2 px-3 py-2 text-xs text-text-hi focus:outline-none focus:ring-1 focus:ring-ice"/> : null}<div className="space-y-2">{utilityMessages.length ? utilityMessages.map((message) => <div key={message.id} className="rounded-input border border-line bg-bg-2/60 p-2"><p className="line-clamp-2 text-xs text-text-hi">{message.body || "Attachment"}</p>{utility === "media" ? <MessageAttachments media={message.media} scope="scene" threadId={conversationId}/> : null}</div>) : <p className="text-xs text-text-lo">Nothing here yet.</p>}</div></div> : null}
    <ConversationTranscript messages={messages} hasOlder={messageQuery.hasNextPage} loadingOlder={messageQuery.isFetchingNextPage} loadOlder={messageQuery.fetchNextPage} peerTypingLabel={realtime.peerTypingLabel} sentByMe={(message) => (resolvedPersonaId && message.sender_scene_persona_id === resolvedPersonaId) || (!!myProfileId && message.sender_profile_id === myProfileId)} renderMessage={(message) => {
      const mine = (resolvedPersonaId && message.sender_scene_persona_id === resolvedPersonaId) || (!!myProfileId && message.sender_profile_id === myProfileId);
      const author = message.sender_profile_id ? byProfile.get(message.sender_profile_id) : undefined;
      const persona = message.sender_scene_persona_id ? byPersona.get(message.sender_scene_persona_id) : null;
      return <MessageBubble message={message} mine={Boolean(mine)} scope="scene" threadId={conversationId} authorLabel={persona?.display_name ?? author?.display_name ?? "Member"} canPin={canPin} onReply={setReplyTo} onEdit={(messageId, body) => mutations.edit.mutateAsync({ messageId, body })} onDelete={(item) => mutations.removeMessage.mutateAsync(item)} onReact={(item, emoji) => mutations.sceneReaction.mutateAsync({ messageId: item.id, sceneId, personaId: resolvedPersonaId!, emoji })} onPin={(item) => mutations.pin.mutateAsync(item.id)} onRetry={(item) => mutations.send.mutateAsync({ conversationId, body: item.body, media: item.media.filter((media): media is import("@/lib/types").MessageAttachment => typeof media !== "string"), replyToMessageId: item.reply_to_message_id, optimisticId: item.id })}/>;
    }}/>
    <div className={cn("shrink-0 border-t border-line p-3", utility && "bg-bg-1/80")}><MessageComposer scope="scene" threadId={conversationId} draftKey={`scene:${conversationId}`} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} onTyping={realtime.sendTyping} pending={mutations.send.isPending} placeholder="Message the Scene..." onSend={async ({ body, media, replyToMessageId }) => { await mutations.send.mutateAsync({ conversationId, body, media, replyToMessageId }); }}/></div>
  </div>;
}
