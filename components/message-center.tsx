"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Headphones, MessageCircle, MessagesSquare, PenSquare } from "lucide-react";
import { useActiveArtist } from "@/components/active-artist-provider";
import { ArtistMark } from "@/components/artists/artist-mark";
import { MessageComposer } from "@/components/messages/message-composer";
import { NewConversationPanel } from "@/components/messages/new-conversation-panel";
import { useArtistProfile } from "@/hooks/use-artist-profile";
import { useConversations, useMessageMutations, useSupportThreads } from "@/hooks/use-messages";

type Selected = { kind: "direct" | "support"; id: string } | null;

export function MessageCenter() {
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Selected>(null);
  const [composing, setComposing] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const { activeArtist } = useActiveArtist();
  const { profile } = useArtistProfile(activeArtist?.id ?? null);
  const onNetwork = profile?.visibility === "members" || profile?.visibility === "public";
  // Existing conversations are private participant records, not network
  // discovery. Only starting a conversation with a new artist requires access.
  const direct = useConversations(profile?.id ?? null);
  const support = useSupportThreads(false);
  const directMutations = useMessageMutations(profile?.id ?? null);
  const directThreads = direct.data ?? [];
  const supportThreads = support.data?.reports ?? [];
  const directUnread = directThreads.reduce((total, thread) => total + (thread.unread_count ?? 0), 0);
  const supportUnread = supportThreads.filter((thread) => thread.last_admin_reply_at && (!thread.member_last_read_at || thread.last_admin_reply_at > thread.member_last_read_at)).length;
  const unread = directUnread + supportUnread;
  const items = [
    ...supportThreads.map((thread) => ({ kind: "support" as const, id: thread.id, title: thread.subject, preview: thread.messages.at(-1)?.body ?? thread.details, time: thread.last_message_at ?? thread.created_at, unread: Boolean(thread.last_admin_reply_at && (!thread.member_last_read_at || thread.last_admin_reply_at > thread.member_last_read_at)) })),
    ...directThreads.map((thread) => ({ kind: "direct" as const, id: thread.id, title: thread.peer?.display_name ?? thread.title ?? "Conversation", preview: thread.last_message_preview ?? "No messages yet", time: thread.last_message_at ?? thread.created_at, unread: (thread.unread_count ?? 0) > 0, thread })),
  ].sort((a, b) => b.time.localeCompare(a.time)).slice(0, 8);
  const activeItem = selected ? items.find((item) => item.kind === selected.kind && item.id === selected.id) : null;

  React.useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function choose(kind: "direct" | "support", id: string) {
    setComposing(false);
    setSelected({ kind, id });
    if (kind === "direct") directMutations.markRead.mutate(id);
    else support.state.mutate({ id, read: true });
  }

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={unread ? `Messages (${unread} unread)` : "Messages"} className="relative flex size-9 items-center justify-center rounded-input text-text-lo transition-colors hover:bg-bg-2 hover:text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice">
        <MessageCircle className="size-[18px]" strokeWidth={1.75}/>
        {unread ? <span className="absolute right-0 top-0 flex size-4 items-center justify-center rounded-full bg-amber font-mono text-[9px] font-bold text-bg-0">{unread > 9 ? "9+" : unread}</span> : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-[70] mt-2 w-[min(26rem,calc(100vw-1.5rem))] overflow-hidden rounded-card border border-line bg-bg-1 shadow-e3">
          <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
            {selected || composing ? (
              <button type="button" onClick={() => { setSelected(null); setComposing(false); }} className="flex items-center gap-1.5 text-xs text-text-lo hover:text-ice"><ArrowLeft className="size-3.5"/>Inbox</button>
            ) : (
              <div><p className="label-mono">Messages</p>{unread ? <p className="mt-1 text-[10px] text-amber">{unread} unread</p> : null}</div>
            )}
            <div className="flex items-center gap-3">
              {onNetwork && !composing ? (
                <button type="button" onClick={() => { setSelected(null); setComposing(true); }} className="flex items-center gap-1.5 text-xs text-text-lo hover:text-ice" aria-label="New message"><PenSquare className="size-3.5"/>New</button>
              ) : null}
              <Link href="/messages" onClick={() => setOpen(false)} className="text-xs text-ice hover:underline">Open Messages</Link>
            </div>
          </div>

          {composing ? (
            <NewConversationPanel compact myProfileId={profile?.id ?? null} onStarted={(conversationId) => choose("direct", conversationId)} />
          ) : selected && activeItem ? (
            <div>
              <div className="flex items-center gap-3 border-b border-line/70 px-4 py-4">
                {activeItem.kind === "support" ? (
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-amber/20 bg-amber/10"><Headphones className="size-4 text-amber"/></span>
                ) : (
                  <ArtistMark emblemUrl={activeItem.thread?.peer?.emblem_url ?? null} paletteId={activeItem.thread?.peer?.palette_id} iceColor={activeItem.thread?.peer?.ice_color} amberColor={activeItem.thread?.peer?.amber_color} name={activeItem.title} size={22} className="size-9"/>
                )}
                <div className="min-w-0"><p className="truncate text-sm font-medium text-text-hi">{activeItem.kind === "support" ? `TEMPO Support · ${activeItem.title}` : activeItem.title}</p><p className="mt-1 truncate text-xs text-text-lo">{activeItem.preview}</p></div>
              </div>
              <div className="bg-bg-0/35 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-text-lo">Quick reply {selected.kind === "support" ? <Headphones className="size-3 text-amber"/> : null}</p>
                <MessageComposer compact scope={selected.kind} threadId={selected.id} pending={directMutations.send.isPending || support.reply.isPending} onSend={async ({ body, media }) => { if (selected.kind === "support") await support.reply.mutateAsync({ id: selected.id, body, media }); else await directMutations.send.mutateAsync({ conversationId: selected.id, body, media }); }}/>
                <Link href={selected.kind === "support" ? `/messages?support=${selected.id}` : `/messages?c=${selected.id}`} onClick={() => setOpen(false)} className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-text-lo hover:text-ice"><MessagesSquare className="size-3"/>View full conversation</Link>
              </div>
            </div>
          ) : selected ? (
            <div className="px-4 py-10 text-center text-xs text-text-lo">Opening conversation…</div>
          ) : items.length ? (
            <div className="max-h-72 overflow-y-auto">
              {items.map((item) => (
                <button key={`${item.kind}-${item.id}`} type="button" onClick={() => choose(item.kind, item.id)} className="flex w-full items-center gap-2.5 border-b border-line/70 px-3 py-2.5 text-left hover:bg-bg-2">
                  {item.kind === "support" ? <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-amber/20 bg-amber/10"><Headphones className="size-3.5 text-amber"/></span> : <ArtistMark emblemUrl={item.thread?.peer?.emblem_url ?? null} paletteId={item.thread?.peer?.palette_id} iceColor={item.thread?.peer?.ice_color} amberColor={item.thread?.peer?.amber_color} name={item.title} size={18} className="size-7"/>}
                  <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-xs font-medium text-text-hi">{item.kind === "support" ? `TEMPO Support · ${item.title}` : item.title}</p>{item.unread ? <span className="ml-auto size-1.5 shrink-0 rounded-full bg-amber"/> : null}</div><p className="mt-0.5 truncate text-[11px] text-text-lo">{item.preview}</p></div>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-10 text-center"><MessagesSquare className="mx-auto size-6 text-text-lo"/><p className="mt-2 text-sm text-text-hi">No conversations yet</p><p className="mt-1 text-xs text-text-lo">Support tickets and artist messages will appear here.</p></div>
          )}
        </div>
      ) : null}
    </div>
  );
}
