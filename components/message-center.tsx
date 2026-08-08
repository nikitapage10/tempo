"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Headphones, MessageCircle, MessagesSquare, PenSquare } from "lucide-react";
import { useActiveArtist } from "@/components/active-artist-provider";
import { ArtistMark } from "@/components/artists/artist-mark";
import { NewConversationPanel } from "@/components/messages/new-conversation-panel";
import { useArtistProfile } from "@/hooks/use-artist-profile";
import { useConversations, useMessageMutations, useSupportThreads } from "@/hooks/use-messages";

export function MessageCenter() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
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

  React.useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function openThread(kind: "direct" | "support", id: string) {
    if (kind === "direct") directMutations.markRead.mutate(id);
    else support.state.mutate({ id, read: true });
    setOpen(false);
    setComposing(false);
    router.push(kind === "support" ? `/messages?support=${id}` : `/messages?c=${id}`);
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
            {composing ? (
              <button type="button" onClick={() => setComposing(false)} className="flex items-center gap-1.5 text-xs text-text-lo hover:text-ice"><ArrowLeft className="size-3.5"/>Inbox</button>
            ) : (
              <div><p className="label-mono">Messages</p>{unread ? <p className="mt-1 text-[10px] text-amber">{unread} unread</p> : null}</div>
            )}
            <div className="flex items-center gap-3">
              {onNetwork && !composing ? (
                <button type="button" onClick={() => setComposing(true)} className="flex items-center gap-1.5 text-xs text-text-lo hover:text-ice" aria-label="New message"><PenSquare className="size-3.5"/>New</button>
              ) : null}
              <Link href="/messages" onClick={() => setOpen(false)} className="text-xs text-ice hover:underline">Open Messages</Link>
            </div>
          </div>

          {composing ? (
            <NewConversationPanel compact myProfileId={profile?.id ?? null} onStarted={(conversationId) => openThread("direct", conversationId)} />
          ) : items.length ? (
            <div className="max-h-96 overflow-y-auto">
              {items.map((item) => (
                <Link key={`${item.kind}-${item.id}`} href={item.kind === "support" ? `/messages?support=${item.id}` : `/messages?c=${item.id}`} onClick={(event) => { event.preventDefault(); openThread(item.kind, item.id); }} className="flex w-full items-start gap-3 border-b border-line/70 px-3 py-3 text-left transition-colors hover:bg-bg-2">
                  {item.kind === "support" ? <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-amber/20 bg-amber/10"><Headphones className="size-3.5 text-amber"/></span> : <ArtistMark emblemUrl={item.thread?.peer?.emblem_url ?? null} paletteId={item.thread?.peer?.palette_id} iceColor={item.thread?.peer?.ice_color} amberColor={item.thread?.peer?.amber_color} name={item.title} size={18} className="size-7"/>}
                  <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-xs font-medium text-text-hi">{item.kind === "support" ? `TEMPO Support · ${item.title}` : item.title}</p>{item.unread ? <span className="ml-auto mt-1 size-1.5 shrink-0 rounded-full bg-amber"/> : null}</div><p className="mt-1 line-clamp-3 whitespace-normal text-[11px] leading-relaxed text-text-lo">{item.preview}</p></div>
                </Link>
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
