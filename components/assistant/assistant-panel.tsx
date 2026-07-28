"use client";

import * as React from "react";
import { Send, X } from "lucide-react";
import { Bubble, Dot } from "@/components/ui/chat-bubble";
import { AssistantActionCard } from "@/components/assistant/assistant-action-card";
import { AssistantEmpty } from "@/components/assistant/assistant-empty";
import { MAX_MESSAGE_CHARS } from "@/lib/assistant/types";
import type { ProposedAction, Turn } from "@/lib/assistant/types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  turns: Turn[];
  thinking: boolean;
  onClose: () => void;
  onSend: (text: string) => void;
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
  const [text, setText] = React.useState("");
  const [acting, setActing] = React.useState(false);
  const textRef = React.useRef<HTMLTextAreaElement>(null);
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => textRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [open]);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, thinking]);

  if (!open) return null;

  const disabled = thinking || acting;
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
    if (!msg || disabled) return;
    setText("");
    void onSend(msg);
  }

  const latestSuggestions =
    !thinking && turns.length > 0
      ? turns[turns.length - 1]?.suggestions ?? []
      : [];

  return (
    <>
      {/* Mobile backdrop */}
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
          // Mobile bottom sheet
          "inset-x-0 bottom-0 h-[85dvh] rounded-t-panel",
          // Desktop floating panel
          "md:inset-x-auto md:bottom-[5.5rem] md:right-5 md:h-[min(70vh,34rem)] md:w-[min(100vw-2.5rem,25rem)] md:rounded-panel",
        )}
      >
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
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

        <div className="border-t border-line px-3 py-3">
          <div className="flex items-end gap-2 rounded-card border border-line bg-bg-2 p-2 shadow-e2 transition-colors duration-hover focus-within:border-ice/50">
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
              rows={1}
              placeholder="Ask about TEMPO or your catalog…"
              className="max-h-28 min-h-[2.25rem] flex-1 resize-none bg-transparent py-2 text-sm text-text-hi placeholder:text-text-lo focus-visible:outline-none"
            />
            <button
              type="button"
              aria-label="Send"
              disabled={disabled || !text.trim()}
              onClick={() => handleSend()}
              className={cn(
                "rounded-input p-2 transition-colors duration-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice",
                text.trim()
                  ? "text-ice hover:text-text-hi"
                  : "text-text-lo opacity-40",
              )}
            >
              <Send className="size-4" />
            </button>
          </div>
          <div className="mt-2 flex items-start justify-between gap-2">
            <p className="text-[11px] leading-relaxed text-text-lo">
              What you type here is sent to an AI service.
            </p>
            {showCounter ? (
              <span className="shrink-0 font-mono text-[11px] text-text-lo">
                {text.length}/{MAX_MESSAGE_CHARS}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
