"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Headphones, Lock, Send, Users } from "lucide-react";
import { useActiveArtist } from "@/components/active-artist-provider";
import { ArtistMark } from "@/components/artists/artist-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const { data: conversations = [], isLoading } = useConversations(onNetwork ? myProfileId : null);
  const support = useSupportThreads();
  const { send, markRead } = useMessageMutations(myProfileId);
  const [activeId, setActiveId] = React.useState<string | null>(searchParams.get("c"));
  const [activeSupportId, setActiveSupportId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const { data: messages = [] } = useMessages(onNetwork && !activeSupportId ? activeId : null);
  const active = conversations.find((conversation) => conversation.id === activeId) ?? null;
  const supportThreads = support.data?.reports ?? [];
  const activeSupport = supportThreads.find((thread) => thread.id === activeSupportId) ?? null;

  React.useEffect(() => { const c = searchParams.get("c"); if (c) { setActiveId(c); setActiveSupportId(null); } }, [searchParams]);
  React.useEffect(() => {
    if (activeId && onNetwork && !activeSupportId) markRead.mutate(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mark once when a thread opens
  }, [activeId, onNetwork, activeSupportId]);

  function chooseDirect(id: string) { setActiveId(id); setActiveSupportId(null); setDraft(""); }
  function chooseSupport(id: string) { setActiveSupportId(id); setActiveId(null); setDraft(""); }
  async function joinNetwork() { try { await publish.mutateAsync("members"); toast("You’re on the network — visible to TEMPO members.", "ok"); } catch (error) { toast(error instanceof Error ? error.message : "Couldn’t join the network."); } }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    if (activeSupportId) {
      support.reply.mutate({ id: activeSupportId, body: draft }, { onSuccess: () => { setDraft(""); toast("Reply sent to TEMPO Support.", "ok"); }, onError: (error) => toast(error.message) });
    } else if (activeId && myProfileId) {
      send.mutate({ conversationId: activeId, body: draft }, { onSuccess: () => setDraft("") });
    }
  }

  return <div className="space-y-5">
    <PageHeader title="Messages" subtitle="Artist conversations and private help from TEMPO Support." />
    <div className="grid min-h-[30rem] gap-3 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="panel-quiet overflow-hidden">
        <div className="border-b border-line px-3 py-2"><p className="label-mono flex items-center gap-2"><Headphones className="size-3.5 text-amber"/>TEMPO Support</p></div>
        {support.isLoading ? <div className="h-16 animate-pulse bg-bg-2/40"/> : supportThreads.length ? <ul>{supportThreads.map((thread) => <li key={thread.id}><button type="button" onClick={() => chooseSupport(thread.id)} className={cn("flex w-full items-start gap-2.5 border-b border-line px-3 py-3 text-left transition-colors hover:bg-bg-2", activeSupportId === thread.id && "bg-amber/[0.07]")}><span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-amber/25 bg-amber/10"><Headphones className="size-3.5 text-amber"/></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm text-text-hi">{thread.subject}</p><span className={cn("ml-auto size-1.5 shrink-0 rounded-full", thread.status === "resolved" ? "bg-ok" : "bg-amber")}/></div><p className="mt-0.5 truncate text-xs text-text-lo">{thread.messages.at(-1)?.body ?? thread.details}</p></div></button></li>)}</ul> : <p className="border-b border-line p-3 text-xs leading-relaxed text-text-lo">Support tickets you submit will appear here.</p>}

        <div className="border-b border-line px-3 py-2"><p className="label-mono">Artist messages</p></div>
        {!profileLoading && !onNetwork ? <div className="p-3"><div className="rounded-input border border-line bg-bg-2/50 p-3"><p className="flex items-center gap-1.5 text-xs font-medium text-text-hi"><Lock className="size-3.5"/>You’re off the network</p><p className="mt-1 text-xs leading-relaxed text-text-lo">Support still works privately. Join only if you want artist DMs.</p><div className="mt-2 flex gap-1.5"><Button type="button" size="sm" disabled={publish.isPending} onClick={() => void joinNetwork()}><Users className="size-3.5"/>Join</Button><Button asChild size="sm" variant="ghost"><Link href="/artist">Settings</Link></Button></div></div></div> : isLoading ? <div className="h-24 animate-pulse bg-bg-2/40"/> : conversations.length === 0 ? <p className="p-3 text-xs leading-relaxed text-text-lo">No artist conversations yet — start one from a member’s profile.</p> : <ul className="max-h-80 overflow-y-auto">{conversations.map((conversation) => <li key={conversation.id}><button type="button" onClick={() => chooseDirect(conversation.id)} className={cn("flex w-full items-center gap-2.5 border-b border-line px-3 py-2.5 text-left transition-colors hover:bg-bg-2", activeId === conversation.id && !activeSupportId && "bg-bg-2")}><ArtistMark emblemUrl={conversation.peer?.emblem_url ?? null} paletteId={conversation.peer?.palette_id} iceColor={conversation.peer?.ice_color} amberColor={conversation.peer?.amber_color} name={conversation.peer?.display_name ?? conversation.title ?? "Chat"} size={18} className="size-[18px]"/><div className="min-w-0 flex-1"><p className="truncate text-sm text-text-hi">{conversation.peer?.display_name ?? conversation.title ?? "Conversation"}</p><p className="truncate text-xs text-text-lo">{conversation.last_message_preview ?? "No messages yet"}</p></div>{(conversation.unread_count ?? 0) > 0 ? <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-amber text-[10px] font-bold text-bg-0">{conversation.unread_count! > 9 ? "9+" : conversation.unread_count}</span> : null}</button></li>)}</ul>}
      </aside>

      <section className="panel flex min-h-[30rem] flex-col overflow-hidden">
        {!activeSupport && !activeId ? <div className="flex flex-1 flex-col items-center justify-center p-6 text-center"><div className="flex size-11 items-center justify-center rounded-full border border-ice/20 bg-ice/10"><Send className="size-5 text-ice"/></div><p className="mt-3 text-sm text-text-hi">Choose a conversation</p><p className="mt-1 max-w-sm text-xs leading-relaxed text-text-lo">Support tickets stay private and do not require a public artist profile.</p></div> : activeSupport ? <>
          <header className="flex items-center gap-3 border-b border-line bg-gradient-to-r from-amber/[0.08] to-transparent px-4 py-3"><span className="flex size-8 items-center justify-center rounded-full border border-amber/25 bg-amber/10"><Headphones className="size-4 text-amber"/></span><div className="min-w-0"><p className="truncate text-sm font-medium text-text-hi">TEMPO Support · {activeSupport.subject}</p><p className="text-xs capitalize text-text-lo">{activeSupport.status.replace("_", " ")} · {activeSupport.category}</p></div></header>
          <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4"><div className="flex justify-end"><div className="max-w-[82%] rounded-card bg-ice/15 px-3 py-2 text-sm text-text-hi"><p className="whitespace-pre-wrap">{activeSupport.details}</p><p className="mt-1 text-[10px] text-text-lo">{formatShortDate(activeSupport.created_at)}</p></div></div>{activeSupport.messages.map((message) => <div key={message.id} className={cn("flex", message.sender_role === "member" ? "justify-end" : "justify-start")}><div className={cn("max-w-[82%] rounded-card px-3 py-2 text-sm text-text-hi", message.sender_role === "member" ? "bg-ice/15" : "border border-amber/15 bg-bg-2")}><p className="whitespace-pre-wrap">{message.body}</p><p className="mt-1 text-[10px] text-text-lo">{message.sender_role === "support" ? "TEMPO Support · " : ""}{formatShortDate(message.created_at)}</p></div></div>)}</div>
        </> : <>
          <header className="flex items-center gap-2 border-b border-line px-4 py-3"><ArtistMark emblemUrl={active?.peer?.emblem_url ?? null} paletteId={active?.peer?.palette_id} iceColor={active?.peer?.ice_color} amberColor={active?.peer?.amber_color} name={active?.peer?.display_name ?? "Chat"} size={20} className="size-5"/><div className="min-w-0"><p className="truncate text-sm font-medium text-text-hi">{active?.peer?.display_name ?? "Conversation"}</p>{active?.peer?.handle ? <p className="text-xs text-text-lo">@{active.peer.handle}</p> : null}</div></header>
          <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">{messages.map((message) => { const mine = message.sender_profile_id === myProfileId; return <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}><div className={cn("max-w-[80%] rounded-card px-3 py-2 text-sm", mine ? "bg-ice/15 text-text-hi" : "bg-bg-2 text-text-hi")}><p className="whitespace-pre-wrap">{message.body}</p><p className="mt-1 text-[10px] text-text-lo">{formatShortDate(message.created_at)}</p></div></div>; })}</div>
        </>}
        {(activeSupport || activeId) ? <form className="flex gap-2 border-t border-line p-3" onSubmit={submit}><Input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={activeSupport ? "Reply to TEMPO Support…" : "Write a message…"} maxLength={5000} className="flex-1"/><Button type="submit" size="sm" disabled={send.isPending || support.reply.isPending}><Send className="size-3.5"/>Send</Button></form> : null}
      </section>
    </div>
  </div>;
}
