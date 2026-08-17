"use client";

import * as React from "react";
import { FileText, Paperclip, Send, X } from "lucide-react";
import { Bubble, Dot } from "@/components/ui/chat-bubble";
import { AssistantActionCard } from "@/components/assistant/assistant-action-card";
import { AssistantEmpty } from "@/components/assistant/assistant-empty";
import { VoiceInput } from "@/components/import/voice-input";
import { useToast } from "@/components/ui/toast";
import { transcribeAssistantVoice } from "@/lib/api/assistant";
import {
  ASSISTANT_ATTACH_ACCEPT,
  ASSISTANT_MAX_ATTACHMENTS,
  fileToAssistantAttachment,
  type AssistantAttachment,
} from "@/lib/assistant/attachments";
import { MAX_MESSAGE_CHARS } from "@/lib/assistant/types";
import type { ProposedAction, Turn } from "@/lib/assistant/types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  turns: Turn[];
  thinking: boolean;
  onClose: () => void;
  onSend: (text: string, attachments?: AssistantAttachment[]) => void;
  onConfirmAction: (turnId: string, action: ProposedAction) => void | Promise<void>;
  onDismissAction: (turnId: string) => void;
  panelRef: React.Ref<HTMLDivElement>;
};

export function AssistantPanel({
  open,
  turns,
  thinking,
  onClose,
  onSend,
  onConfirmAction,
  onDismissAction,
  panelRef,
}: Props) {
  const { toast } = useToast();
  const [text, setText] = React.useState("");
  const [attachments, setAttachments] = React.useState<AssistantAttachment[]>([]);
  const [acting, setActing] = React.useState(false);
  const [transcribing, setTranscribing] = React.useState(false);
  const textRef = React.useRef<HTMLTextAreaElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const endRef = React.useRef<HTMLDivElement>(null);
  const dictationBaseRef = React.useRef("");

  React.useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => textRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [open]);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, thinking]);

  React.useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const max = 10 * 20;
    el.style.height = "0px";
    const content = el.scrollHeight;
    el.style.height = `${Math.min(max, Math.max(content, 72))}px`;
    el.style.overflowY = content > max ? "auto" : "hidden";
  }, [text, open]);

  if (!open) return null;

  const disabled = thinking || acting || transcribing;
  const canSend = Boolean(text.trim() || attachments.length > 0);
  const showCounter = text.length > 800;

  async function handleConfirm(turnId: string, action: ProposedAction) {
    setActing(true);
    try {
      await onConfirmAction(turnId, action);
    } finally {
      setActing(false);
    }
  }

  function handleSend(value?: string) {
    const msg = (value ?? text).trim();
    const files = value != null ? [] : attachments;
    if ((!msg && files.length === 0) || disabled) return;
    if (value == null) {
      setText("");
      setAttachments([]);
    }
    void onSend(msg, files);
  }

  async function handleFiles(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    const room = ASSISTANT_MAX_ATTACHMENTS - attachments.length;
    if (room <= 0) {
      toast(`You can attach up to ${ASSISTANT_MAX_ATTACHMENTS} files.`, "info");
      return;
    }
    const next: AssistantAttachment[] = [...attachments];
    for (const file of files.slice(0, room)) {
      try {
        next.push(await fileToAssistantAttachment(file));
      } catch (err) {
        toast(err instanceof Error ? err.message : "Couldn't add that file.");
      }
    }
    setAttachments(next);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleVoiceRecording(file: File) {
    setTranscribing(true);
    try {
      const spoken = await transcribeAssistantVoice(file);
      setText((prev) => {
        const base = prev.trim();
        const merged = base ? `${base} ${spoken}` : spoken;
        return merged.slice(0, MAX_MESSAGE_CHARS);
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't hear that recording.");
    } finally {
      setTranscribing(false);
    }
  }

  const latestSuggestions =
    !thinking && turns.length > 0
      ? turns[turns.length - 1]?.suggestions ?? []
      : [];

  return (
    <>
      <button
        type="button"
        aria-label="Close assistant"
        className="fixed inset-0 z-[90] bg-black/60 md:hidden"
        onClick={onClose}
      />

      <div
        ref={panelRef}
        id="tempo-assistant-panel"
        role="dialog"
        aria-label="TEMPO assistant"
        className={cn(
          "fixed z-[90] flex flex-col overflow-hidden border border-line bg-gradient-to-b from-bg-1 to-bg-0 shadow-e3",
          "animate-in fade-in slide-in-from-bottom-2 duration-200 motion-reduce:animate-none",
          "inset-x-0 bottom-0 h-[85dvh] rounded-t-panel",
          "md:inset-x-auto md:bottom-[5.5rem] md:right-5 md:h-[min(70vh,34rem)] md:w-[min(100vw-2.5rem,25rem)] md:rounded-panel",
        )}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
          <p className="label-mono">ASSISTANT</p>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-input p-1.5 text-text-lo transition-colors duration-hover hover:text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
          >
            <X className="size-4" />
          </button>
        </header>

        <div
          className="well mx-3 mt-3 min-h-0 flex-1 overflow-y-auto p-3"
          aria-live="polite"
        >
          {turns.length === 0 && !thinking ? (
            <AssistantEmpty onPick={(p) => handleSend(p)} disabled={disabled} />
          ) : (
            <div className="space-y-3">
              {turns.map((turn) => {
                if (turn.role === "artist") {
                  return (
                    <Bubble key={turn.id} from="artist">
                      <p className="whitespace-pre-wrap text-sm text-text-hi">
                        {turn.text}
                      </p>
                      {turn.attachmentNames && turn.attachmentNames.length > 0 ? (
                        <ul className="mt-2 space-y-1">
                          {turn.attachmentNames.map((name) => (
                            <li
                              key={name}
                              className="flex items-center gap-1.5 text-xs text-text-lo"
                            >
                              <FileText className="size-3 shrink-0" />
                              <span className="truncate">{name}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </Bubble>
                  );
                }
                return (
                  <Bubble key={turn.id} from="tempo">
                    <p className="whitespace-pre-wrap text-sm text-text-hi">
                      {turn.text}
                    </p>
                    {turn.action && turn.actionStatus !== "dismissed" ? (
                      <AssistantActionCard
                        action={turn.action}
                        status={turn.actionStatus ?? "pending"}
                        doneLabel={turn.actionDoneLabel}
                        busy={acting}
                        onConfirm={() =>
                          void handleConfirm(turn.id, turn.action!)
                        }
                        onDismiss={() => onDismissAction(turn.id)}
                      />
                    ) : null}
                  </Bubble>
                );
              })}

              {thinking ? (
                <Bubble from="tempo">
                  <p className="flex items-center gap-2 text-sm text-text-lo">
                    <span className="flex gap-1" aria-hidden>
                      <Dot delay="0ms" />
                      <Dot delay="150ms" />
                      <Dot delay="300ms" />
                    </span>
                    <span className="sr-only">TEMPO is thinking</span>
                  </p>
                </Bubble>
              ) : null}

              {latestSuggestions.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pl-10">
                  {latestSuggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={disabled}
                      onClick={() => handleSend(s)}
                      className="rounded-chip border border-ice/30 bg-ice/10 px-2.5 py-1 text-xs text-ice transition-colors duration-hover hover:bg-ice/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice disabled:opacity-40"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : null}

              <div ref={endRef} />
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-line px-3 py-3">
          {attachments.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {attachments.map((att, i) => (
                <span
                  key={`${att.name}-${i}`}
                  className="inline-flex max-w-full items-center gap-1 rounded-chip border border-line bg-bg-1 px-2 py-0.5 text-xs text-text-lo"
                >
                  <FileText className="size-3 shrink-0" />
                  <span className="truncate">{att.name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${att.name}`}
                    disabled={disabled}
                    className="rounded-input p-0.5 hover:text-text-hi"
                    onClick={() =>
                      setAttachments((prev) => prev.filter((_, j) => j !== i))
                    }
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}

          <div className="rounded-card border border-line bg-bg-2 p-2 shadow-e2 transition-colors duration-hover focus-within:border-ice/50">
            <input
              ref={fileRef}
              type="file"
              accept={ASSISTANT_ATTACH_ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => void handleFiles(e.target.files)}
            />
            <textarea
              ref={textRef}
              value={text}
              maxLength={MAX_MESSAGE_CHARS}
              onChange={(e) => setText(e.target.value.slice(0, MAX_MESSAGE_CHARS))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={disabled}
              rows={3}
              placeholder="Ask about TEMPO or your catalog…"
              className="block w-full min-h-[4.5rem] resize-none overflow-hidden bg-transparent px-1 py-1.5 text-sm leading-5 text-text-hi placeholder:text-text-lo focus-visible:outline-none [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-line"
            />
            <div className="mt-1 flex items-center justify-between gap-1">
              <button
                type="button"
                aria-label="Attach files"
                title="Attach a screenshot, PDF, or text file"
                disabled={disabled || attachments.length >= ASSISTANT_MAX_ATTACHMENTS}
                onClick={() => fileRef.current?.click()}
                className="rounded-input p-2 text-text-lo transition-colors duration-hover hover:text-ice focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice disabled:opacity-40"
              >
                <Paperclip className="size-4" />
              </button>
              <div className="flex items-center">
                <VoiceInput
                  disabled={disabled}
                  onStart={() => {
                    dictationBaseRef.current = text.trim();
                  }}
                  onTranscript={(spoken) => {
                    const base = dictationBaseRef.current;
                    const merged = base ? `${base} ${spoken}` : spoken;
                    setText(merged.slice(0, MAX_MESSAGE_CHARS));
                  }}
                  onRecorded={(file) => void handleVoiceRecording(file)}
                />
                <button
                  type="button"
                  aria-label="Send"
                  disabled={disabled || !canSend}
                  onClick={() => handleSend()}
                  className={cn(
                    "rounded-input p-2 transition-colors duration-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice",
                    canSend
                      ? "text-ice hover:text-text-hi"
                      : "text-text-lo opacity-40",
                  )}
                >
                  <Send className="size-4" />
                </button>
              </div>
            </div>
          </div>
          <div className="mt-2 flex items-start justify-between gap-2">
            <p className="text-xs leading-relaxed text-text-lo">
              What you type or attach here is sent to an AI service.
            </p>
            {showCounter ? (
              <span className="shrink-0 font-mono text-xs text-text-lo">
                {text.length}/{MAX_MESSAGE_CHARS}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
