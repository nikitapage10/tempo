"use client";

import * as React from "react";
import { ArrowDown, Loader2 } from "lucide-react";
import type { ConversationMessage } from "@/lib/types";
import { isNearConversationBottom, preservedScrollTop, shouldAutoFollowConversation } from "@/lib/messages/behavior";

export function ConversationTranscript({ messages, renderMessage, hasOlder, loadingOlder, loadOlder, peerTypingLabel, sentByMe }: {
  messages: ConversationMessage[];
  renderMessage: (message: ConversationMessage) => React.ReactNode;
  hasOlder?: boolean;
  loadingOlder?: boolean;
  loadOlder?: () => Promise<unknown> | void;
  peerTypingLabel?: string | null;
  sentByMe: (message: ConversationMessage) => boolean;
}) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const initializedRef = React.useRef(false);
  const previousLastIdRef = React.useRef<string | null>(null);
  const [awayFromBottom, setAwayFromBottom] = React.useState(false);
  const [unseen, setUnseen] = React.useState(0);

  const scrollToBottom = React.useCallback((behavior: ScrollBehavior = "smooth") => {
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior });
    setAwayFromBottom(false);
    setUnseen(0);
  }, []);

  React.useLayoutEffect(() => {
    const node = scrollerRef.current;
    if (!node || !messages.length) return;
    const last = messages.at(-1)!;
    if (!initializedRef.current) {
      initializedRef.current = true;
      previousLastIdRef.current = last.id;
      scrollToBottom("auto");
      return;
    }
    if (last.id === previousLastIdRef.current) return;
    previousLastIdRef.current = last.id;
    if (shouldAutoFollowConversation({ nearBottom: !awayFromBottom, sentByMe: sentByMe(last) })) scrollToBottom(sentByMe(last) ? "smooth" : "auto");
    else setUnseen((value) => value + 1);
  }, [awayFromBottom, messages, scrollToBottom, sentByMe]);

  async function prependOlder() {
    const node = scrollerRef.current;
    if (!node || !loadOlder) return;
    const beforeHeight = node.scrollHeight;
    const beforeTop = node.scrollTop;
    await loadOlder();
    requestAnimationFrame(() => {
      node.scrollTop = preservedScrollTop({ beforeHeight, beforeTop, afterHeight: node.scrollHeight });
    });
  }

  return <div className="relative min-h-0 flex-1">
    <div ref={scrollerRef} onScroll={(event) => { const node = event.currentTarget; const away = !isNearConversationBottom(node); setAwayFromBottom(away); if (!away) setUnseen(0); }} className="absolute inset-0 overflow-y-auto overscroll-contain px-4 py-4">
      {hasOlder ? <div className="mb-4 flex justify-center"><button type="button" disabled={loadingOlder} onClick={() => void prependOlder()} className="inline-flex items-center gap-1 rounded-chip border border-line px-3 py-1.5 text-xs text-text-lo hover:text-ice disabled:opacity-50">{loadingOlder ? <Loader2 className="size-3 animate-spin"/> : null}Load older messages</button></div> : null}
      <div className="space-y-3">{messages.map((message) => <div key={message.id} style={{ contentVisibility: "auto", containIntrinsicSize: "48px" }}>{renderMessage(message)}</div>)}</div>
      {peerTypingLabel ? <p role="status" className="mt-3 text-xs text-text-lo"><span className="text-ice">...</span> {peerTypingLabel} is typing</p> : null}
    </div>
    {awayFromBottom && unseen > 0 ? <button type="button" onClick={() => scrollToBottom()} className="absolute bottom-3 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1 rounded-chip border border-ice/30 bg-bg-1 px-3 py-1.5 text-xs text-ice shadow-e2"><ArrowDown className="size-3.5"/>{unseen} new {unseen === 1 ? "message" : "messages"}</button> : null}
  </div>;
}
