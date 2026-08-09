"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Archive, ArchiveRestore, ChevronLeft, Headphones, Lock, MessagesSquare, PenSquare, Trash2, Users, X } from "lucide-react";
import { useActiveArtist } from "@/components/active-artist-provider";
import { ArtistMark } from "@/components/artists/artist-mark";
import { MessageAttachments } from "@/components/messages/message-attachments";
import { MessageComposer } from "@/components/messages/message-composer";
import { NewConversationPanel } from "@/components/messages/new-conversation-panel";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { useArtistProfile } from "@/hooks/use-artist-profile";
import { useConversations, useMessageMutations, useMessages, useSupportThreads } from "@/hooks/use-messages";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function MessagesView() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { activeArtist } = useActiveArtist();
  const { profile, isLoading: profileLoading, publish } = useArtistProfile(activeArtist?.id ?? null);
  const myProfileId = profile?.id ?? null;
  const onNetwork = profile?.visibility === "members" || profile?.visibility === "public";
  // Search can deep-link straight into an archived thread, so honour the flag.
  const [archived, setArchived] = React.useState(searchParams.get("archived") === "1");
  const [composing, setComposing] = React.useState(false);
  // A private profile can still receive and reply to an official/team thread.
  // Network visibility only gates discovering and messaging new artists.
  const { data: conversations = [], isLoading } = useConversations(myProfileId, archived);
  const support = useSupportThreads(archived);
  const mutations = useMessageMutations(myProfileId);
  const [activeId, setActiveId] = React.useState<string | null>(searchParams.get("c"));
  const [activeSupportId, setActiveSupportId] = React.useState<string | null>(searchParams.get("support"));
  const { data: messages = [] } = useMessages(!activeSupportId ? activeId : null);
  const active = conversations.find((conversation) => conversation.id === activeId) ?? null;
  const supportThreads = support.data?.reports ?? [];
  const activeSupport = supportThreads.find((thread) => thread.id === activeSupportId) ?? null;
  // Below lg the list and the open thread can't share the screen — this tracks
  // which pane a phone/tablet is currently showing, with a Back button to return.
  const showingThread = composing || Boolean(active) || Boolean(activeSupport);

  React.useEffect(() => { const directId = searchParams.get("c"); const supportId = searchParams.get("support"); if (directId || supportId) setArchived(searchParams.get("archived") === "1"); if (directId) { setActiveId(directId); setActiveSupportId(null); } else if (supportId) { setActiveSupportId(supportId); setActiveId(null); } }, [searchParams]);
  React.useEffect(() => {
    if (activeId && !activeSupportId) mutations.markRead.mutate(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mark once when a thread opens
  }, [activeId, activeSupportId]);

  function chooseDirect(id: string) { setActiveId(id); setActiveSupportId(null); setComposing(false); }
  function chooseSupport(id: string) { setActiveSupportId(id); setActiveId(null); support.state.mutate({ id, read: true }); }
  function switchArchive(next: boolean) { setArchived(next); setActiveId(null); setActiveSupportId(null); }
  async function joinNetwork() { try { await publish.mutateAsync("members"); toast("You’re on the network and visible to TEMPO members.", "ok"); } catch (error) { toast(error instanceof Error ? error.message : "Couldn’t join the network."); } }
  async function archiveActive() { try { if (activeSupport) await support.state.mutateAsync({ id: activeSupport.id, archived: !archived }); else if (activeId) await mutations.archive.mutateAsync({ conversationId: activeId, archived: !archived }); toast(archived ? "Conversation restored." : "Conversation archived.", "ok"); setActiveId(null); setActiveSupportId(null); } catch (error) { toast(error instanceof Error ? error.message : "Couldn’t update that conversation."); } }

  return <div className="space-y-5">
    <PageHeader title="Messages" subtitle="Artist conversations and private help from TEMPO Support." actions={<div className="flex items-center gap-2">{onNetwork ? <Button type="button" size="sm" variant={composing ? "secondary" : "default"} onClick={() => { setComposing((value) => !value); setActiveId(null); setActiveSupportId(null); }}>{composing ? <X className="size-3.5"/> : <PenSquare className="size-3.5"/>}{composing ? "Cancel" : "New message"}</Button> : null}<div className="flex rounded-input border border-line bg-bg-1 p-1"><button type="button" onClick={() => switchArchive(false)} className={cn("rounded-md px-3 py-1.5 text-xs", !archived ? "bg-ice text-bg-0" : "text-text-lo")}>Inbox</button><button type="button" onClick={() => switchArchive(true)} className={cn("rounded-md px-3 py-1.5 text-xs", archived ? "bg-ice text-bg-0" : "text-text-lo")}>Archived</button></div></div>}/>
    <div className="grid min-h-[32rem] gap-3 lg:grid-cols-[19rem_minmax(0,1fr)]">
      <aside className={cn("panel-quiet overflow-hidden", showingThread && "hidden lg:block")}>
        <div className="border-b border-line px-3 py-2"><p className="label-mono flex items-center gap-2"><Headphones className="size-3.5 text-amber"/>TEMPO Support</p></div>
        {support.isLoading ? <div className="h-16 animate-pulse bg-bg-2/40"/> : supportThreads.length ? <ul>{supportThreads.map((thread) => { const unread = Boolean(thread.last_admin_reply_at && (!thread.member_last_read_at || thread.last_admin_reply_at > thread.member_last_read_at)); return <li key={thread.id}><button type="button" onClick={() => chooseSupport(thread.id)} className={cn("flex w-full items-start gap-2.5 border-b border-line px-3 py-3 text-left transition-colors hover:bg-bg-2", activeSupportId === thread.id && "bg-amber/[0.07]")}><span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-amber/25 bg-amber/10"><Headphones className="size-3.5 text-amber"/></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm text-text-hi">{thread.subject}</p>{unread ? <span className="ml-auto size-2 shrink-0 rounded-full bg-amber"/> : <span className={cn("ml-auto size-1.5 shrink-0 rounded-full", thread.status === "resolved" ? "bg-ok" : "bg-text-lo")}/>}</div><p className="mt-0.5 truncate text-xs text-text-lo">{thread.messages.at(-1)?.body || (thread.messages.at(-1)?.media?.length ? "Sent an attachment" : thread.details)}</p></div></button></li>; })}</ul> : <p className="border-b border-line p-3 text-xs leading-relaxed text-text-lo">{archived ? "No archived support tickets." : "Support tickets you submit will appear here."}</p>}
        <div className="border-b border-line px-3 py-2"><p className="label-mono">Artist messages</p></div>
        {!profileLoading && !onNetwork ? <div className="p-3"><div className="rounded-input border border-line bg-bg-2/50 p-3"><p className="flex items-center gap-1.5 text-xs font-medium text-text-hi"><Lock className="size-3.5"/>You’re off the network</p><p className="mt-1 text-xs leading-relaxed text-text-lo">You can still use existing team conversations privately. Join when you want to find and message other artists.</p><div className="mt-2 flex gap-1.5"><Button type="button" size="sm" disabled={publish.isPending} onClick={() => void joinNetwork()}><Users className="size-3.5"/>Join</Button><Button asChild size="sm" variant="ghost"><Link href="/artist">Settings</Link></Button></div></div></div> : null}
        {isLoading ? <div className="h-24 animate-pulse bg-bg-2/40"/> : conversations.length === 0 ? <p className="p-3 text-xs leading-relaxed text-text-lo">{archived ? "No archived artist conversations." : onNetwork ? "No artist conversations yet. Use New message, or start one from a member’s profile." : "Official and existing team conversations will appear here."}</p> : <ul className="max-h-80 overflow-y-auto">{conversations.map((conversation) => <li key={conversation.id}><button type="button" onClick={() => chooseDirect(conversation.id)} className={cn("flex w-full items-center gap-2.5 border-b border-line px-3 py-2.5 text-left transition-colors hover:bg-bg-2", activeId === conversation.id && !activeSupportId && "bg-bg-2")}><ArtistMark emblemUrl={conversation.peer?.emblem_url ?? null} paletteId={conversation.peer?.palette_id} iceColor={conversation.peer?.ice_color} amberColor={conversation.peer?.amber_color} name={conversation.peer?.display_name ?? conversation.title ?? "Chat"} size={18} className="size-[18px]"/><div className="min-w-0 flex-1"><p className="truncate text-sm text-text-hi">{conversation.peer?.display_name ?? conversation.title ?? "Conversation"}</p><p className="truncate text-xs text-text-lo">{conversation.last_message_preview ?? "No messages yet"}</p></div>{(conversation.unread_count ?? 0) > 0 ? <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-amber text-[10px] font-bold text-bg-0">{conversation.unread_count! > 9 ? "9+" : conversation.unread_count}</span> : null}</button></li>)}</ul>}
      </aside>
      <section className={cn("panel flex min-h-[32rem] flex-col overflow-hidden", !showingThread && "hidden lg:flex")}>
        {composing ? <div className="flex flex-1 flex-col"><div className="flex items-center gap-2 border-b border-line px-4 py-3"><Button type="button" size="sm" variant="ghost" className="-ml-2 lg:hidden" onClick={() => setComposing(false)} aria-label="Back to inbox"><X className="size-3.5"/></Button><div><p className="text-sm font-medium text-text-hi">New message</p><p className="mt-0.5 text-xs text-text-lo">Find any artist on the TEMPO network and start a conversation.</p></div></div><NewConversationPanel myProfileId={myProfileId} onStarted={chooseDirect}/></div> : !activeSupport && !active ? <div className="flex flex-1 flex-col items-center justify-center p-6 text-center"><span className="flex size-11 items-center justify-center rounded-full border border-ice/20 bg-ice/10"><MessagesSquare className="size-5 text-ice"/></span><p className="mt-3 text-sm text-text-hi">Choose a conversation</p><p className="mt-1 max-w-sm text-xs leading-relaxed text-text-lo">Send files, dictate a reply, or keep support separate from your artist network.</p></div> : <>
          <header className={cn("flex items-center gap-3 border-b border-line px-4 py-3", activeSupport && "bg-gradient-to-r from-amber/[0.08] to-transparent")}><Button type="button" size="sm" variant="ghost" className="-ml-2 shrink-0 lg:hidden" onClick={() => { setActiveId(null); setActiveSupportId(null); }} aria-label="Back to inbox"><ChevronLeft className="size-4"/></Button>{activeSupport ? <span className="flex size-8 items-center justify-center rounded-full border border-amber/25 bg-amber/10"><Headphones className="size-4 text-amber"/></span> : <ArtistMark emblemUrl={active?.peer?.emblem_url ?? null} paletteId={active?.peer?.palette_id} iceColor={active?.peer?.ice_color} amberColor={active?.peer?.amber_color} name={active?.peer?.display_name ?? "Chat"} size={20} className="size-6"/>}<div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-text-hi">{activeSupport ? `TEMPO Support · ${activeSupport.subject}` : active?.peer?.display_name ?? "Conversation"}</p><p className="text-xs text-text-lo">{activeSupport ? `${activeSupport.status.replace("_", " ")} · ${activeSupport.category}` : active?.peer?.handle ? `@${active.peer.handle}` : "Direct message"}</p></div><Button size="sm" variant="ghost" onClick={() => void archiveActive()}>{archived ? <ArchiveRestore className="size-3.5"/> : <Archive className="size-3.5"/>}{archived ? "Restore" : "Archive"}</Button></header>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">{activeSupport ? <><div className="flex justify-end"><div className="max-w-[82%] rounded-card bg-ice/15 px-3 py-2 text-sm text-text-hi"><p className="whitespace-pre-wrap">{activeSupport.details}</p><p className="mt-1 text-[10px] text-text-lo">{formatShortDate(activeSupport.created_at)}</p></div></div>{activeSupport.messages.map((message) => { const mine = message.sender_role === "member"; return <div key={message.id} className={cn("group flex items-end gap-1", mine ? "justify-end" : "justify-start")}>{mine ? <button type="button" aria-label="Delete message" onClick={() => { if (window.confirm("Delete this message?")) support.removeMessage.mutate({ id: activeSupport.id, messageId: message.id }); }} className="invisible rounded-input p-1.5 text-text-lo hover:text-warn group-hover:visible"><Trash2 className="size-3.5"/></button> : null}<div className={cn("max-w-[82%] rounded-card px-3 py-2 text-sm text-text-hi", mine ? "bg-ice/15" : "border border-amber/15 bg-bg-2")}><p className="whitespace-pre-wrap">{message.body}</p><MessageAttachments media={message.media} scope="support" threadId={activeSupport.id}/><p className="mt-1 text-[10px] text-text-lo">{mine ? "" : "TEMPO Support · "}{formatShortDate(message.created_at)}</p></div></div>; })}</> : messages.map((message) => { const mine = message.sender_profile_id === myProfileId; return <div key={message.id} className={cn("group flex items-end gap-1", mine ? "justify-end" : "justify-start")}>{mine ? <button type="button" aria-label="Delete message" onClick={() => { if (window.confirm("Delete this message?")) mutations.removeMessage.mutate(message.id); }} className="invisible rounded-input p-1.5 text-text-lo hover:text-warn group-hover:visible"><Trash2 className="size-3.5"/></button> : null}<div className={cn("max-w-[80%] rounded-card px-3 py-2 text-sm", mine ? "bg-ice/15 text-text-hi" : "bg-bg-2 text-text-hi")}><p className="whitespace-pre-wrap">{message.body}</p><MessageAttachments media={message.media} scope="direct" threadId={active!.id}/><p className="mt-1 text-[10px] text-text-lo">{formatShortDate(message.created_at)}</p></div></div>; })}</div>
          {!archived ? <div className="border-t border-line p-3"><MessageComposer scope={activeSupport ? "support" : "direct"} threadId={activeSupport?.id ?? active!.id} pending={mutations.send.isPending || support.reply.isPending} placeholder={activeSupport ? "Reply to TEMPO Support…" : "Write a message…"} onSend={async ({ body, media }) => { if (activeSupport) { await support.reply.mutateAsync({ id: activeSupport.id, body, media }); toast("Reply sent to TEMPO Support.", "ok"); } else await mutations.send.mutateAsync({ conversationId: active!.id, body, media }); }}/></div> : null}
        </>}
      </section>
    </div>
  </div>;
}
