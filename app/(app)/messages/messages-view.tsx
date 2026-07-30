"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Lock, Send, Users } from "lucide-react";
import { useActiveArtist } from "@/components/active-artist-provider";
import { ArtistMark } from "@/components/artists/artist-mark";
import { EmptyShaderPanel } from "@/components/shader-empty";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { useArtistProfile } from "@/hooks/use-artist-profile";
import {
  useConversations,
  useMessageMutations,
  useMessages,
} from "@/hooks/use-messages";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function MessagesView() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { activeArtist } = useActiveArtist();
  const { profile, isLoading: profileLoading, publish } = useArtistProfile(
    activeArtist?.id ?? null
  );
  const myProfileId = profile?.id ?? null;
  const onNetwork =
    profile?.visibility === "members" || profile?.visibility === "public";
  const { data: conversations = [], isLoading } = useConversations(
    onNetwork ? myProfileId : null
  );
  const { send, markRead } = useMessageMutations(myProfileId);

  const [activeId, setActiveId] = React.useState<string | null>(
    searchParams.get("c")
  );
  const [draft, setDraft] = React.useState("");

  React.useEffect(() => {
    const c = searchParams.get("c");
    if (c) setActiveId(c);
  }, [searchParams]);

  React.useEffect(() => {
    if (activeId && onNetwork) markRead.mutate(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mark once when thread opens
  }, [activeId, onNetwork]);

  const { data: messages = [] } = useMessages(onNetwork ? activeId : null);
  const active = conversations.find((c) => c.id === activeId) ?? null;

  async function joinNetwork() {
    try {
      await publish.mutateAsync("members");
      toast("You’re on the network — visible to TEMPO members.", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t join the network.");
    }
  }

  if (!profileLoading && !onNetwork) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="Messages"
          subtitle="Direct threads with other TEMPO artists — join the network to use them."
        />
        <EmptyShaderPanel
          title="You’re off the network"
          copy="Messaging is part of the social network. Stay private if you want — or join when you’re ready to talk with other TEMPO artists."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                size="sm"
                disabled={publish.isPending}
                onClick={() => void joinNetwork()}
              >
                <Users className="size-3.5" />
                Join as TEMPO member
              </Button>
              <Button asChild size="sm" variant="secondary">
                <Link href="/artist">
                  <Lock className="size-3.5" />
                  Network settings
                </Link>
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Messages"
        subtitle="Direct threads with other TEMPO artists."
      />

      <div className="grid min-h-[28rem] gap-3 lg:grid-cols-[16rem_1fr]">
        <aside className="panel-quiet overflow-hidden">
          <p className="label-mono border-b border-line px-3 py-2">Threads</p>
          {isLoading ? (
            <div className="h-24 animate-pulse bg-bg-2/40" />
          ) : conversations.length === 0 ? (
            <p className="p-3 text-sm text-text-lo">
              No conversations yet — open someone&apos;s profile and tap Message.
            </p>
          ) : (
            <ul className="max-h-[32rem] overflow-y-auto">
              {conversations.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(c.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 border-b border-line px-3 py-2.5 text-left transition-colors hover:bg-bg-2",
                      activeId === c.id && "bg-bg-2"
                    )}
                  >
                    <ArtistMark
                      emblemUrl={c.peer?.emblem_url ?? null}
                      paletteId={c.peer?.palette_id}
                      iceColor={c.peer?.ice_color}
                      amberColor={c.peer?.amber_color}
                      name={c.peer?.display_name ?? c.title ?? "Chat"}
                      size={18}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-text-hi">
                        {c.peer?.display_name ?? c.title ?? "Conversation"}
                      </p>
                      <p className="truncate text-xs text-text-lo">
                        {c.last_message_preview ?? "No messages yet"}
                      </p>
                    </div>
                    {(c.unread_count ?? 0) > 0 ? (
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-amber text-[10px] font-bold text-bg-0">
                        {c.unread_count! > 9 ? "9+" : c.unread_count}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="panel flex min-h-[28rem] flex-col overflow-hidden">
          {!activeId ? (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-text-lo">
              Pick a thread, or message someone from their profile.
            </div>
          ) : (
            <>
              <header className="flex items-center gap-2 border-b border-line px-4 py-3">
                <ArtistMark
                  emblemUrl={active?.peer?.emblem_url ?? null}
                  paletteId={active?.peer?.palette_id}
                  iceColor={active?.peer?.ice_color}
                  amberColor={active?.peer?.amber_color}
                  name={active?.peer?.display_name ?? "Chat"}
                  size={20}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-hi">
                    {active?.peer?.display_name ?? "Conversation"}
                  </p>
                  {active?.peer?.handle ? (
                    <p className="text-xs text-text-lo">@{active.peer.handle}</p>
                  ) : null}
                </div>
              </header>

              <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
                {messages.map((m) => {
                  const mine = m.sender_profile_id === myProfileId;
                  return (
                    <div
                      key={m.id}
                      className={cn("flex", mine ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] rounded-card px-3 py-2 text-sm",
                          mine
                            ? "bg-ice/15 text-text-hi"
                            : "bg-bg-2 text-text-hi"
                        )}
                      >
                        <p className="whitespace-pre-wrap">{m.body}</p>
                        <p className="mt-1 text-[10px] text-text-lo">
                          {formatShortDate(m.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form
                className="flex gap-2 border-t border-line p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!draft.trim() || !activeId || !myProfileId) return;
                  send.mutate(
                    { conversationId: activeId, body: draft },
                    { onSuccess: () => setDraft("") }
                  );
                }}
              >
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Write a message…"
                  maxLength={5000}
                  className="flex-1"
                />
                <Button type="submit" size="sm" disabled={send.isPending}>
                  <Send className="size-3.5" />
                  Send
                </Button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
