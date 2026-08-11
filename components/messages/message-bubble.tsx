"use client";

import * as React from "react";
import { Pencil, Pin, PinOff, Reply, RotateCcw, SmilePlus, Trash2 } from "lucide-react";
import { MessageAttachments } from "@/components/messages/message-attachments";
import { formatShortDate } from "@/lib/format";
import type { ConversationMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

const QUICK_REACTIONS = ["\u{1F44D}", "\u2764\uFE0F", "\u{1F525}", "\u{1F602}", "\u{1F44F}", "\u{1F3A7}"];

export function MessageBubble({ message, mine, scope, threadId, authorLabel, canReact = true, canPin = true, onReply, onEdit, onDelete, onReact, onPin, onRetry }: {
  message: ConversationMessage;
  mine: boolean;
  scope: "direct" | "scene";
  threadId: string;
  authorLabel?: string;
  canReact?: boolean;
  canPin?: boolean;
  onReply: (message: ConversationMessage) => void;
  onEdit: (messageId: string, body: string) => Promise<unknown> | void;
  onDelete: (message: ConversationMessage) => Promise<unknown> | void;
  onReact: (message: ConversationMessage, emoji: string) => Promise<unknown> | void;
  onPin: (message: ConversationMessage) => Promise<unknown> | void;
  onRetry?: (message: ConversationMessage) => Promise<unknown> | void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [editText, setEditText] = React.useState(message.body);
  const [showReactions, setShowReactions] = React.useState(false);
  const deleted = Boolean(message.deleted_at);

  async function saveEdit() {
    const body = editText.trim();
    if (!body || body === message.body) { setEditing(false); return; }
    await onEdit(message.id, body);
    setEditing(false);
  }

  return <div className={cn("flex items-end", mine ? "justify-end" : "justify-start")}>
    <div className="group relative w-fit max-w-[80%]">
      <div className={cn(
        "pointer-events-none absolute bottom-0 z-10 flex scale-95 items-center gap-0.5 rounded-chip border border-line/80 bg-bg-1/95 p-0.5 opacity-0 shadow-e2 backdrop-blur-sm transition-[opacity,transform] group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:scale-100 group-focus-within:opacity-100",
        mine ? "right-full origin-right" : "left-full origin-left",
      )}>
      {!deleted ? <button type="button" title="Reply" aria-label="Reply" onClick={() => onReply(message)} className="rounded-input p-1.5 text-text-lo hover:text-ice"><Reply className="size-3.5"/></button> : null}
      {canReact && !deleted ? <button type="button" title="React" aria-label="React" onClick={() => setShowReactions((value) => !value)} className="rounded-input p-1.5 text-text-lo hover:text-ice"><SmilePlus className="size-3.5"/></button> : null}
      {canPin && !deleted ? <button type="button" title={message.pinned ? "Unpin" : "Pin"} aria-label={message.pinned ? "Unpin" : "Pin"} onClick={() => void onPin(message)} className="rounded-input p-1.5 text-text-lo hover:text-ice">{message.pinned ? <PinOff className="size-3.5"/> : <Pin className="size-3.5"/>}</button> : null}
      {mine && !deleted && !message.client_status ? <button type="button" title="Edit" aria-label="Edit" onClick={() => setEditing(true)} className="rounded-input p-1.5 text-text-lo hover:text-ice"><Pencil className="size-3.5"/></button> : null}
      {mine && !deleted && !message.client_status ? <button type="button" title="Delete" aria-label="Delete" onClick={() => { if (window.confirm("Delete this message?")) void onDelete(message); }} className="rounded-input p-1.5 text-text-lo hover:text-warn"><Trash2 className="size-3.5"/></button> : null}
      </div>
      <div className={cn("relative rounded-card px-3 py-2 text-sm", mine ? "bg-ice/15 text-text-hi" : "bg-bg-2 text-text-hi", deleted && "border border-dashed border-line bg-transparent text-text-lo")}>
      {message.pinned ? <p className="mb-1 flex items-center gap-1 text-[10px] text-amber"><Pin className="size-2.5"/>Pinned</p> : null}
      {!mine && authorLabel ? <p className="mb-1 text-[10px] text-text-lo">{authorLabel}</p> : null}
      {message.reply_preview ? <div className="mb-2 rounded-input border-l-2 border-ice/60 bg-bg-0/30 px-2 py-1 text-[11px] text-text-lo">{message.reply_preview.deleted ? "Deleted message" : message.reply_preview.body || "Attachment"}</div> : null}
      {deleted ? <p className="italic">Deleted message</p> : editing ? <div className="space-y-2"><textarea autoFocus value={editText} onChange={(event) => setEditText(event.target.value.slice(0, 5000))} className="min-h-16 w-full resize-y rounded-input border border-line bg-bg-0 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ice"/><div className="flex justify-end gap-2"><button type="button" onClick={() => setEditing(false)} className="text-xs text-text-lo">Cancel</button><button type="button" onClick={() => void saveEdit()} className="text-xs text-ice">Save</button></div></div> : <p className="whitespace-pre-wrap break-words">{message.body}</p>}
      {!deleted ? <MessageAttachments media={message.media} scope={scope} threadId={threadId}/> : null}
      <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-text-lo">{message.edited_at ? <span>Edited</span> : null}<span>{formatShortDate(message.created_at)}</span>{message.client_status === "sending" ? <span>Sending...</span> : null}{message.client_status === "failed" ? <button type="button" onClick={() => void onRetry?.(message)} className="inline-flex items-center gap-1 text-warn"><RotateCcw className="size-2.5"/>Failed - retry</button> : null}</p>
      {showReactions ? <div className="absolute -bottom-8 right-0 z-20 flex rounded-chip border border-line bg-bg-1 p-1 shadow-e2">{QUICK_REACTIONS.map((emoji) => <button key={emoji} type="button" onClick={() => { void onReact(message, emoji); setShowReactions(false); }} className="rounded-full p-1 text-sm hover:bg-bg-3">{emoji}</button>)}</div> : null}
      {message.reactions?.length ? <div className="mt-1.5 flex flex-wrap gap-1">{message.reactions.map((reaction) => <button key={reaction.emoji} type="button" onClick={() => void onReact(message, reaction.emoji)} className={cn("rounded-chip border px-1.5 py-0.5 text-[11px]", reaction.reacted_by_me ? "border-ice/40 bg-ice/10" : "border-line bg-bg-0/30")}>{reaction.emoji} {reaction.count}</button>)}</div> : null}
      </div>
    </div>
  </div>;
}
