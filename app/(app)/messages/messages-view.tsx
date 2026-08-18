"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Archive, ArchiveRestore, ChevronLeft, Files, Headphones, Lock, MessagesSquare, PenSquare, Phone, Pin, Radio, Search, Trash2, UserPlus, Users, Video, Volume2, VolumeX, X } from "lucide-react";
import { useCall } from "@/components/calls/call-provider";
import { useActiveArtist } from "@/components/active-artist-provider";
import { useWorkspaceMode } from "@/hooks/use-workspace-mode";
import { ArtistMark } from "@/components/artists/artist-mark";
import { ConversationTranscript } from "@/components/messages/conversation-transcript";
import { ExpandDirectPanel } from "@/components/messages/expand-direct-panel";
import { GroupAvatar } from "@/components/messages/group-avatar";
import { GroupMembersPanel } from "@/components/messages/group-members-panel";
import { MessageAttachments } from "@/components/messages/message-attachments";
import { MessageBubble } from "@/components/messages/message-bubble";
import { MessageComposer } from "@/components/messages/message-composer";
import { NewConversationPanel } from "@/components/messages/new-conversation-panel";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { useArtistProfile } from "@/hooks/use-artist-profile";
import { useConversationRealtime } from "@/hooks/use-conversation-realtime";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useConversationMessages, useConversations, useMessageMutations, useMessageSearch, useSupportMessageSearch, useSupportMessages, useSupportThreads } from "@/hooks/use-messages";
import { formatShortDate } from "@/lib/format";
import { canExpandDirectConversation, conversationHeading, conversationMemberLabel, isArtistGroupConversation, isSessionConversation, MESSAGES_WORKSPACE_HEIGHT_CLASS } from "@/lib/messages/behavior";
import { isMyMessage, messageAuthorLabel } from "@/lib/sessions/message-authorship";
import type { Conversation, ConversationMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

type UtilityView = "search" | "pins" | "media" | null;

export default function MessagesView() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { activeArtist } = useActiveArtist();
  const currentUser = useCurrentUser();
  const call = useCall();
  const { socialArtistId, mode } = useWorkspaceMode();
  const { profile, isLoading: profileLoading, publish } = useArtistProfile(socialArtistId ?? activeArtist?.id ?? null);
  const myProfileId = profile?.id ?? null;
  const onNetwork = profile?.visibility === "members" || profile?.visibility === "public";
  const [archived, setArchived] = React.useState(searchParams.get("archived") === "1");
  const [composing, setComposing] = React.useState(false);
  const [inboxQuery, setInboxQuery] = React.useState("");
  const [activeId, setActiveId] = React.useState<string | null>(searchParams.get("c"));
  const [activeSupportId, setActiveSupportId] = React.useState<string | null>(searchParams.get("support"));
  const [replyTo, setReplyTo] = React.useState<ConversationMessage | null>(null);
  const [supportReplyTo, setSupportReplyTo] = React.useState<import("@/lib/api/support-messages").SupportMessage | null>(null);
  const [utility, setUtility] = React.useState<UtilityView>(null);
  const [messageQuery, setMessageQuery] = React.useState("");
  const [showMembers, setShowMembers] = React.useState(false);
  const [showExpand, setShowExpand] = React.useState(false);

  const { data: conversations = [], isLoading } = useConversations(myProfileId, archived);
  const support = useSupportThreads(archived);
  const mutations = useMessageMutations(myProfileId);
  const messageQueryState = useConversationMessages(!activeSupportId ? activeId : null);
  const messages = messageQueryState.messages;
  const searchResults = useMessageSearch(activeId, messageQuery);
  const active = conversations.find((conversation) => conversation.id === activeId) ?? null;
  const supportThreads = support.data?.reports ?? [];
  const activeSupport = supportThreads.find((thread) => thread.id === activeSupportId) ?? null;
  const supportMessages = useSupportMessages(activeSupport?.id ?? null);
  const supportSearchResults = useSupportMessageSearch(activeSupport?.id ?? null, messageQuery);
  const showingThread = composing || Boolean(activeId) || Boolean(activeSupport);
  const realtime = useConversationRealtime({ scope: activeSupport ? "support" : "conversation", threadId: activeSupport?.id ?? activeId, typingLabel: profile?.display_name ?? "Someone" });

  React.useEffect(() => {
    const directId = searchParams.get("c");
    const supportId = searchParams.get("support");
    if (directId || supportId) setArchived(searchParams.get("archived") === "1");
    if (directId) { setActiveId(directId); setActiveSupportId(null); }
    else if (supportId) { setActiveSupportId(supportId); setActiveId(null); }
  }, [searchParams]);
  React.useEffect(() => {
    if (activeId && !activeSupportId) mutations.markRead.mutate(activeId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, activeSupportId]);
  React.useEffect(() => { setReplyTo(null); setSupportReplyTo(null); setUtility(null); setMessageQuery(""); setShowMembers(false); setShowExpand(false); }, [activeId, activeSupportId]);

  const visibleConversations = conversations.filter((conversation) => {
    const haystack = [
      conversation.peer?.display_name ?? "",
      conversation.title ?? "",
      conversation.last_message_preview ?? "",
      ...(conversation.members ?? []).map((member) => member.display_name),
    ].join(" ").toLowerCase();
    return haystack.includes(inboxQuery.toLowerCase());
  });
  const teamConversations = visibleConversations.filter((conversation) => conversation.team_artist_id);
  const sessionConversations = visibleConversations.filter((conversation) => isSessionConversation({ sessionRoomId: conversation.session_room_id }));
  const groupConversations = visibleConversations.filter((conversation) => isArtistGroupConversation({ kind: conversation.kind, teamArtistId: conversation.team_artist_id, sessionRoomId: conversation.session_room_id }));
  const directConversations = visibleConversations.filter((conversation) => conversation.kind === "direct");
  const visibleSupport = supportThreads.filter((thread) => `${thread.subject} ${thread.category}`.toLowerCase().includes(inboxQuery.toLowerCase()));

  function chooseDirect(id: string) { setActiveId(id); setActiveSupportId(null); setComposing(false); }
  function chooseSupport(id: string) { setActiveSupportId(id); setActiveId(null); setComposing(false); support.state.mutate({ id, read: true }); }
  function switchArchive(next: boolean) { setArchived(next); setActiveId(null); setActiveSupportId(null); }
  async function joinNetwork() { try { await publish.mutateAsync("members"); toast("You're on the network and visible to TEMPO members.", "ok"); } catch (error) { toast(error instanceof Error ? error.message : "Couldn't join the network."); } }
  async function archiveActive() { try { if (activeSupport) await support.state.mutateAsync({ id: activeSupport.id, archived: !archived }); else if (activeId) await mutations.archive.mutateAsync({ conversationId: activeId, archived: !archived }); toast(archived ? "Conversation restored." : "Conversation archived.", "ok"); setActiveId(null); setActiveSupportId(null); } catch (error) { toast(error instanceof Error ? error.message : "Couldn't update that conversation."); } }
  const activeIsGroup = Boolean(active && isArtistGroupConversation({ kind: active.kind, teamArtistId: active.team_artist_id, sessionRoomId: active.session_room_id }));
  const activeIsSession = Boolean(active && isSessionConversation({ sessionRoomId: active.session_room_id }));
  const activeCanExpand = Boolean(active && canExpandDirectConversation({ kind: active.kind, teamArtistId: active.team_artist_id }));
  const activeHeading = activeSupport
    ? `TEMPO Support / ${activeSupport.subject}`
    : active
      ? conversationHeading({ kind: active.kind, title: active.title, teamArtistId: active.team_artist_id, sessionRoomId: active.session_room_id, peerName: active.peer?.display_name })
      : "Conversation";
  const activeSubheading = activeSupport
    ? `${activeSupport.status.replace("_", " ")} / ${activeSupport.category}`
    : activeIsGroup
      ? conversationMemberLabel((active?.members ?? []).map((member) => member.display_name))
      : activeIsSession
        ? "Session"
        : active?.peer?.handle
        ? `@${active.peer.handle}`
        : active?.team_artist_id
          ? "Team room"
          : "Direct message";
  const authorByProfile = new Map((active?.members ?? []).map((member) => [member.id, member.display_name]));

  return <div className="space-y-3">
    <PageHeader className="mb-3" title="Messages" subtitle="Artist conversations, Scene connections, and private help from TEMPO Support." actions={<div className="flex items-center gap-2">{onNetwork ? <Button type="button" size="sm" variant={composing ? "secondary" : "default"} onClick={() => { setComposing((value) => !value); setActiveId(null); setActiveSupportId(null); }}>{composing ? <X className="size-3.5"/> : <PenSquare className="size-3.5"/>}{composing ? "Cancel" : "New message"}</Button> : null}<div className="flex rounded-input border border-line bg-bg-1 p-1"><button type="button" onClick={() => switchArchive(false)} className={cn("rounded-md px-3 py-1.5 text-xs", !archived ? "bg-ice text-bg-0" : "text-text-lo")}>Inbox</button><button type="button" onClick={() => switchArchive(true)} className={cn("rounded-md px-3 py-1.5 text-xs", archived ? "bg-ice text-bg-0" : "text-text-lo")}>Archived</button></div></div>}/>
    <div className={cn("grid gap-3 lg:grid-cols-[19rem_minmax(0,1fr)]", MESSAGES_WORKSPACE_HEIGHT_CLASS)}>
      <aside className={cn("panel-quiet min-h-0 overflow-hidden", showingThread && "hidden lg:flex", "flex-col")}>
        <div className="border-b border-line p-2"><label className="flex items-center gap-2 rounded-input border border-line bg-bg-2 px-2.5 py-2"><Search className="size-3.5 text-text-lo"/><input value={inboxQuery} onChange={(event) => setInboxQuery(event.target.value)} placeholder="Search conversations" className="min-w-0 flex-1 bg-transparent text-xs text-text-hi placeholder:text-text-lo focus:outline-none"/></label></div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="border-b border-line px-3 py-2"><p className="label-mono flex items-center gap-2"><Headphones className="size-3.5 text-amber"/>TEMPO Support</p></div>
          {support.isLoading ? <div className="h-16 animate-pulse bg-bg-2/40"/> : visibleSupport.length ? <ul>{visibleSupport.map((thread) => { const unread = Boolean(thread.last_admin_reply_at && (!thread.member_last_read_at || thread.last_admin_reply_at > thread.member_last_read_at)); return <li key={thread.id}><button type="button" onClick={() => chooseSupport(thread.id)} className={cn("flex w-full items-start gap-2.5 border-b border-line px-3 py-3 text-left hover:bg-bg-2", activeSupportId === thread.id && "bg-amber/[0.07]")}><span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-amber/25 bg-amber/10"><Headphones className="size-3.5 text-amber"/></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm text-text-hi">{thread.subject}</p>{unread ? <span className="ml-auto size-2 rounded-full bg-amber"/> : null}</div><p className="mt-0.5 truncate text-xs text-text-lo">{thread.messages.at(-1)?.body || (thread.messages.at(-1)?.media?.length ? "Sent an attachment" : thread.details)}</p></div></button></li>; })}</ul> : <p className="border-b border-line p-3 text-xs text-text-lo">{archived ? "No archived support tickets." : "Support tickets you submit will appear here."}</p>}
          <div className="border-b border-line px-3 py-2"><p className="label-mono flex items-center gap-2"><Users className="size-3.5 text-ice"/>Teams</p></div>
          {teamConversations.length ? <ul>{teamConversations.map((conversation) => <li key={conversation.id}><InboxRow conversation={conversation} active={activeId === conversation.id} onChoose={chooseDirect} team/></li>)}</ul> : <p className="border-b border-line p-3 text-xs text-text-lo">Team rooms appear when an artist opens one.</p>}
          <div className="border-b border-line px-3 py-2"><p className="label-mono flex items-center gap-2"><Radio className="size-3.5 text-ice"/>Sessions</p></div>
          {sessionConversations.length ? <ul>{sessionConversations.map((conversation) => <li key={conversation.id}><InboxRow conversation={conversation} active={activeId === conversation.id} onChoose={chooseDirect} session/></li>)}</ul> : <p className="border-b border-line p-3 text-xs text-text-lo">{archived ? "No archived Session chats." : "Session chats appear when you join a room."}</p>}
          <div className="border-b border-line px-3 py-2"><p className="label-mono flex items-center gap-2"><MessagesSquare className="size-3.5 text-ice"/>Groups</p></div>
          {groupConversations.length ? <ul>{groupConversations.map((conversation) => <li key={conversation.id}><InboxRow conversation={conversation} active={activeId === conversation.id} onChoose={chooseDirect} group/></li>)}</ul> : <p className="border-b border-line p-3 text-xs text-text-lo">{archived ? "No archived group chats." : "Start a group from New message."}</p>}
          <div className="border-b border-line px-3 py-2"><p className="label-mono">Artist messages</p></div>
          {!profileLoading && !onNetwork ? <div className="p-3"><div className="rounded-input border border-line bg-bg-2/50 p-3"><p className="flex items-center gap-1.5 text-xs font-medium text-text-hi"><Lock className="size-3.5"/>You&apos;re off the network</p><p className="mt-1 text-xs leading-relaxed text-text-lo">Existing conversations remain private. Join to find and message artists.</p><div className="mt-2 flex gap-1.5"><Button type="button" size="sm" disabled={publish.isPending} onClick={() => void joinNetwork()}><Users className="size-3.5"/>Join</Button><Button asChild size="sm" variant="ghost"><Link href={mode === "work" ? "/settings?tab=studio" : "/artist"}>Settings</Link></Button></div></div></div> : null}
          {isLoading ? <div className="h-24 animate-pulse bg-bg-2/40"/> : directConversations.length === 0 ? <p className="p-3 text-xs text-text-lo">{archived ? "No archived artist conversations." : "No matching conversations."}</p> : <ul>{directConversations.map((conversation) => <li key={conversation.id}><InboxRow conversation={conversation} active={activeId === conversation.id} onChoose={chooseDirect}/></li>)}</ul>}
        </div>
      </aside>
      <section className={cn("panel flex min-h-0 flex-col overflow-hidden", !showingThread && "hidden lg:flex")}>
        {composing ? <div className="flex min-h-0 flex-1 flex-col"><div className="border-b border-line px-4 py-3"><p className="text-sm font-medium text-text-hi">New message</p><p className="text-xs text-text-lo">Message one artist, or start a group chat.</p></div><NewConversationPanel myProfileId={myProfileId} onStarted={chooseDirect}/></div> : !activeSupport && !activeId ? <div className="flex flex-1 flex-col items-center justify-center p-6 text-center"><span className="flex size-11 items-center justify-center rounded-full border border-ice/20 bg-ice/10"><MessagesSquare className="size-5 text-ice"/></span><p className="mt-3 text-sm text-text-hi">Choose a conversation</p><p className="mt-1 max-w-sm text-xs text-text-lo">Messages stay inside a focused, scrollable workspace.</p></div> : <>
          <header className={cn("flex shrink-0 items-center gap-3 border-b border-line px-4 py-3", activeSupport && "bg-gradient-to-r from-amber/[0.08] to-transparent")}><Button type="button" size="sm" variant="ghost" className="-ml-2 lg:hidden" onClick={() => { setActiveId(null); setActiveSupportId(null); }} aria-label="Back"><ChevronLeft className="size-4"/></Button>{activeSupport ? <span className="flex size-8 items-center justify-center rounded-full border border-amber/25 bg-amber/10"><Headphones className="size-4 text-amber"/></span> : activeIsSession ? <span className="flex size-8 items-center justify-center rounded-full border border-ice/25 bg-ice/10"><Radio className="size-4 text-ice"/></span> : activeIsGroup ? <GroupAvatar members={active?.members} size={24} className="size-6"/> : <ArtistMark emblemUrl={active?.peer?.emblem_url ?? null} paletteId={active?.peer?.palette_id} iceColor={active?.peer?.ice_color} amberColor={active?.peer?.amber_color} name={active?.peer?.display_name ?? "Chat"} size={20} className="size-6"/>}<div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-text-hi">{activeHeading}</p><p className="text-xs text-text-lo">{activeSubheading}</p></div>{!activeSupport ? <>{activeCanExpand ? <Button size="sm" variant="ghost" aria-label="Add someone to a new group" onClick={() => { setShowExpand((value) => !value); setShowMembers(false); }}><UserPlus className="size-3.5"/></Button> : null}{activeIsGroup ? <Button size="sm" variant="ghost" aria-label="Group members" onClick={() => { setShowMembers((value) => !value); setShowExpand(false); }}><Users className="size-3.5"/></Button> : null}<Button size="sm" variant="ghost" aria-label="Search messages" onClick={() => setUtility(utility === "search" ? null : "search")}><Search className="size-3.5"/></Button><Button size="sm" variant="ghost" aria-label="Pinned messages" onClick={() => setUtility(utility === "pins" ? null : "pins")}><Pin className="size-3.5"/></Button><Button size="sm" variant="ghost" aria-label="Shared media" onClick={() => setUtility(utility === "media" ? null : "media")}><Files className="size-3.5"/></Button><Button size="sm" variant="ghost" onClick={() => mutations.mute.mutate({ conversationId: active!.id, muted: !active!.muted })}>{active?.muted ? <Volume2 className="size-3.5"/> : <VolumeX className="size-3.5"/>}</Button><Button size="sm" variant="ghost" onClick={() => { mutations.markUnread.mutate(active!.id); setActiveId(null); }}>Mark unread</Button></> : null}<Button size="sm" variant="ghost" onClick={() => void archiveActive()}>{archived ? <ArchiveRestore className="size-3.5"/> : <Archive className="size-3.5"/>}{archived ? "Restore" : "Archive"}</Button></header>
          {active && !activeIsSession && !activeSupport && !archived ? (
            <div className="flex shrink-0 justify-end border-b border-line px-3 py-1.5">
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  call.start({
                    scope: "conversation",
                    id: active.id,
                    title: activeHeading,
                    href: `/messages?c=${active.id}`,
                  })
                }
              >
                <Phone className="size-3.5" />
                Call
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  call.startVideo({
                    scope: "conversation",
                    id: active.id,
                    title: activeHeading,
                    href: `/messages?c=${active.id}`,
                  })
                }
              >
                <Video className="size-3.5" />
                Video
              </Button>
            </div>
          ) : null}
          {showExpand && active && activeCanExpand ? <ExpandDirectPanel conversation={active} myProfileId={myProfileId} onCreated={(id) => { setShowExpand(false); chooseDirect(id); }} onCancel={() => setShowExpand(false)}/> : null}
          {showMembers && active && activeIsGroup ? <GroupMembersPanel conversation={active} myProfileId={myProfileId} onLeft={() => { setShowMembers(false); setActiveId(null); }}/> : null}
          {activeSupport ? <div className="flex shrink-0 justify-end gap-1 border-b border-line px-3 py-1.5"><Button size="sm" variant="ghost" onClick={() => setUtility(utility === "search" ? null : "search")}><Search className="size-3.5"/>Search</Button><Button size="sm" variant="ghost" onClick={() => setUtility(utility === "media" ? null : "media")}><Files className="size-3.5"/>Shared media</Button></div> : null}
          {utility && active ? <UtilityPanel view={utility} messages={messages} query={messageQuery} setQuery={setMessageQuery} searchResults={searchResults.data ?? []} threadId={active.id} onClose={() => setUtility(null)}/> : utility && activeSupport ? <SupportUtilityPanel view={utility} messages={supportMessages.messages.length ? supportMessages.messages : activeSupport.messages} query={messageQuery} setQuery={setMessageQuery} searchResults={supportSearchResults.data ?? []} threadId={activeSupport.id} onClose={() => setUtility(null)}/> : null}
          {activeId ? <ConversationTranscript messages={messages} hasOlder={messageQueryState.hasNextPage} loadingOlder={messageQueryState.isFetchingNextPage} loadOlder={messageQueryState.fetchNextPage} peerTypingLabel={realtime.peerTypingLabel} sentByMe={(message) => isMyMessage({ senderUserId: message.sender_user_id, currentUserId: currentUser?.id }) || message.sender_user_id === "current"} renderMessage={(message) => <MessageBubble message={message} mine={isMyMessage({ senderUserId: message.sender_user_id, currentUserId: currentUser?.id }) || message.sender_user_id === "current"} scope="direct" threadId={activeId} authorLabel={message.sender_guest_name ? messageAuthorLabel({ guestName: message.sender_guest_name }) : activeIsGroup || activeIsSession || active?.team_artist_id ? authorByProfile.get(message.sender_profile_id ?? "") ?? "Member" : undefined} canPin={!activeIsGroup || active?.my_role === "admin"} onReply={setReplyTo} onEdit={(messageId, body) => mutations.edit.mutateAsync({ messageId, body })} onDelete={(item) => mutations.removeMessage.mutateAsync(item)} onReact={(item, emoji) => mutations.reaction.mutateAsync({ messageId: item.id, profileId: myProfileId!, emoji })} onPin={(item) => mutations.pin.mutateAsync(item.id)} onRetry={(item) => mutations.send.mutateAsync({ conversationId: activeId, body: item.body, media: item.media.filter((media): media is import("@/lib/types").MessageAttachment => typeof media !== "string"), replyToMessageId: item.reply_to_message_id, optimisticId: item.id })}/>}/> : activeSupport ? <SupportTranscript thread={activeSupport} messages={supportMessages.messages.length ? supportMessages.messages : activeSupport.messages} hasOlder={supportMessages.hasNextPage} loadOlder={() => supportMessages.fetchNextPage()} onReply={setSupportReplyTo} onEdit={(messageId, body) => support.edit.mutateAsync({ id: activeSupport.id, messageId, body })} onDelete={(messageId) => support.removeMessage.mutate({ id: activeSupport.id, messageId })} typing={realtime.peerTypingLabel}/> : null}
          {!archived ? <div className="shrink-0 border-t border-line bg-bg-1/70 p-3"><MessageComposer scope={activeSupport ? "support" : "direct"} threadId={activeSupport?.id ?? activeId!} draftKey={`${activeSupport ? "support" : "direct"}:${activeSupport?.id ?? activeId!}`} pending={mutations.send.isPending || support.reply.isPending} replyTo={activeSupport ? supportReplyTo : replyTo} onCancelReply={() => { setReplyTo(null); setSupportReplyTo(null); }} onTyping={realtime.sendTyping} placeholder={activeSupport ? "Reply to TEMPO Support..." : "Write a message..."} onSend={async ({ body, media, replyToMessageId }) => { if (activeSupport) { await support.reply.mutateAsync({ id: activeSupport.id, body, media, replyToMessageId }); toast("Reply sent to TEMPO Support.", "ok"); } else await mutations.send.mutateAsync({ conversationId: activeId!, body, media, replyToMessageId }); }}/></div> : null}
        </>}
      </section>
    </div>
  </div>;
}

function InboxRow({ conversation, active, onChoose, team = false, group = false, session = false }: { conversation: Conversation; active: boolean; onChoose: (id: string) => void; team?: boolean; group?: boolean; session?: boolean }) {
  const heading = conversationHeading({ kind: conversation.kind, title: conversation.title, teamArtistId: conversation.team_artist_id, sessionRoomId: conversation.session_room_id, peerName: conversation.peer?.display_name });
  const preview = conversation.last_message_preview ?? (team ? "Team room" : session ? "Session" : group ? "Group chat" : "No messages yet");
  return <button type="button" onClick={() => onChoose(conversation.id)} className={cn("flex w-full items-center gap-2.5 border-b border-line px-3 py-2.5 text-left hover:bg-bg-2", active && "bg-bg-2")}>
    {team ? <span className="flex size-[18px] items-center justify-center rounded-full border border-ice/25 bg-ice/10"><Users className="size-3 text-ice"/></span> : session ? <span className="flex size-[18px] items-center justify-center rounded-full border border-ice/25 bg-ice/10"><Radio className="size-3 text-ice"/></span> : group ? <GroupAvatar members={conversation.members} size={18} className="size-[18px]"/> : <ArtistMark emblemUrl={conversation.peer?.emblem_url ?? null} paletteId={conversation.peer?.palette_id} iceColor={conversation.peer?.ice_color} amberColor={conversation.peer?.amber_color} name={heading} size={18} className="size-[18px]"/>}
    <div className="min-w-0 flex-1"><p className="truncate text-sm text-text-hi">{heading}</p><p className="truncate text-xs text-text-lo">{preview}</p></div>
    {conversation.muted ? <VolumeX className="size-3 text-text-lo"/> : null}
    {(conversation.unread_count ?? 0) > 0 ? <span className="flex size-5 items-center justify-center rounded-full bg-amber text-[11px] font-bold text-bg-0">{conversation.unread_count! > 9 ? "9+" : conversation.unread_count}</span> : null}
  </button>;
}

function UtilityPanel({ view, messages, query, setQuery, searchResults, threadId, onClose }: { view: Exclude<UtilityView, null>; messages: ConversationMessage[]; query: string; setQuery: (value: string) => void; searchResults: ConversationMessage[]; threadId: string; onClose: () => void }) {
  const rows = view === "pins" ? messages.filter((message) => message.pinned) : view === "media" ? messages.filter((message) => message.media.length) : searchResults;
  return <div className="max-h-48 shrink-0 overflow-y-auto border-b border-line bg-bg-1/90 p-3"><div className="mb-2 flex items-center gap-2"><p className="label-mono flex-1">{view === "search" ? "Search messages" : view === "pins" ? "Pinned messages" : "Shared media"}</p><button type="button" onClick={onClose} aria-label="Close"><X className="size-3.5 text-text-lo"/></button></div>{view === "search" ? <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search text and filenames" className="mb-2 w-full rounded-input border border-line bg-bg-2 px-3 py-2 text-xs text-text-hi focus:outline-none focus:ring-1 focus:ring-ice"/> : null}<div className="space-y-2">{rows.length ? rows.map((message) => <div key={message.id} className="rounded-input border border-line bg-bg-2/60 p-2"><p className="line-clamp-2 text-xs text-text-hi">{message.body || (message.deleted_at ? "Deleted message" : "Attachment")}</p>{view === "media" ? <MessageAttachments media={message.media} scope="direct" threadId={threadId}/> : null}<p className="mt-1 text-[11px] text-text-lo">{formatShortDate(message.created_at)}</p></div>) : <p className="text-xs text-text-lo">{view === "search" && query.length < 2 ? "Type at least two characters." : "Nothing here yet."}</p>}</div></div>;
}

function SupportUtilityPanel({ view, messages, query, setQuery, searchResults, threadId, onClose }: { view: Exclude<UtilityView, null>; messages: import("@/lib/api/support-messages").SupportMessage[]; query: string; setQuery: (value: string) => void; searchResults: import("@/lib/api/support-messages").SupportMessage[]; threadId: string; onClose: () => void }) {
  const rows = view === "media" ? messages.filter((message) => message.media.length) : searchResults;
  return <div className="max-h-48 shrink-0 overflow-y-auto border-b border-line bg-bg-1/90 p-3"><div className="mb-2 flex items-center gap-2"><p className="label-mono flex-1">{view === "search" ? "Search support messages" : "Shared media"}</p><button type="button" onClick={onClose} aria-label="Close"><X className="size-3.5 text-text-lo"/></button></div>{view === "search" ? <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search text and filenames" className="mb-2 w-full rounded-input border border-line bg-bg-2 px-3 py-2 text-xs text-text-hi focus:outline-none focus:ring-1 focus:ring-ice"/> : null}<div className="space-y-2">{rows.length ? rows.map((message) => <div key={message.id} className="rounded-input border border-line bg-bg-2/60 p-2"><p className="line-clamp-2 text-xs text-text-hi">{message.body || "Attachment"}</p>{view === "media" ? <MessageAttachments media={message.media} scope="support" threadId={threadId}/> : null}<p className="mt-1 text-[11px] text-text-lo">{formatShortDate(message.created_at)}</p></div>) : <p className="text-xs text-text-lo">{view === "search" && query.length < 2 ? "Type at least two characters." : "Nothing here yet."}</p>}</div></div>;
}

function SupportTranscript({ thread, messages, hasOlder, loadOlder, onReply, onEdit, onDelete, typing }: { thread: import("@/lib/api/support-messages").SupportThread; messages: import("@/lib/api/support-messages").SupportMessage[]; hasOlder?: boolean; loadOlder: () => void; onReply: (message: import("@/lib/api/support-messages").SupportMessage) => void; onEdit: (messageId: string, body: string) => Promise<unknown>; onDelete: (messageId: string) => void; typing: string | null }) {
  return <div className="spectra-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto py-4 pl-4 pr-7 sm:pr-8"><div className="space-y-3">{hasOlder ? <div className="text-center"><button type="button" onClick={loadOlder} className="rounded-chip border border-line px-3 py-1.5 text-xs text-text-lo">Load older messages</button></div> : null}<div className="flex justify-end"><div className="max-w-[82%] rounded-card bg-ice/15 px-3 py-2 text-sm text-text-hi"><p className="whitespace-pre-wrap">{thread.details}</p><p className="mt-1 text-[11px] text-text-lo">{formatShortDate(thread.created_at)}</p></div></div>{messages.map((message) => <SupportMessageRow key={message.id} message={message} threadId={thread.id} onReply={onReply} onEdit={onEdit} onDelete={onDelete}/>) }{typing ? <p className="text-xs text-text-lo"><span className="text-ice">...</span> {typing} is typing</p> : null}</div></div>;
}

function SupportMessageRow({ message, threadId, onReply, onEdit, onDelete }: { message: import("@/lib/api/support-messages").SupportMessage; threadId: string; onReply: (message: import("@/lib/api/support-messages").SupportMessage) => void; onEdit: (messageId: string, body: string) => Promise<unknown>; onDelete: (messageId: string) => void }) {
  const mine = message.sender_role === "member";
  const [editing, setEditing] = React.useState(false);
  const [body, setBody] = React.useState(message.body);
  return <div className={cn("flex items-end", mine ? "justify-end" : "justify-start")}><div className="group relative w-fit max-w-[82%]"><div className={cn("pointer-events-none absolute bottom-0 z-10 flex scale-95 items-center rounded-chip border border-line/80 bg-bg-1/95 p-0.5 opacity-0 shadow-e2 backdrop-blur-sm transition-[opacity,transform] group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:scale-100 group-focus-within:opacity-100", mine ? "right-full origin-right" : "left-full origin-left")}>{!message.deleted_at ? <button type="button" onClick={() => onReply(message)} className="rounded-input p-1.5 text-xs text-text-lo hover:text-ice">Reply</button> : null}{mine && !message.deleted_at ? <button type="button" onClick={() => setEditing(true)} className="rounded-input p-1.5 text-xs text-text-lo hover:text-ice">Edit</button> : null}{mine && !message.deleted_at ? <button type="button" aria-label="Delete message" onClick={() => { if (window.confirm("Delete this message?")) onDelete(message.id); }} className="rounded-input p-1.5 text-text-lo hover:text-warn"><Trash2 className="size-3.5"/></button> : null}</div><div className={cn("rounded-card px-3 py-2 text-sm text-text-hi", mine ? "bg-ice/15" : "border border-amber/15 bg-bg-2", message.deleted_at && "border border-dashed border-line bg-transparent text-text-lo")}>{editing ? <div><textarea value={body} onChange={(event) => setBody(event.target.value)} className="w-full rounded-input border border-line bg-bg-0 p-2"/><button type="button" onClick={() => void onEdit(message.id, body).then(() => setEditing(false))} className="mt-1 text-xs text-ice">Save</button></div> : <p className={cn("whitespace-pre-wrap", message.deleted_at && "italic")}>{message.deleted_at ? "Deleted message" : message.body}</p>}{!message.deleted_at ? <MessageAttachments media={message.media} scope="support" threadId={threadId}/> : null}<p className="mt-1 text-[11px] text-text-lo">{mine ? "" : "TEMPO Support / "}{message.edited_at ? "Edited / " : ""}{formatShortDate(message.created_at)}</p></div></div></div>;
}
