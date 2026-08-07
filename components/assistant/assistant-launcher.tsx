"use client";

import { X } from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  hasUnread: boolean;
  onToggle: () => void;
  launcherRef?: React.Ref<HTMLButtonElement>;
};

export function AssistantLauncher({
  open,
  hasUnread,
  onToggle,
  launcherRef,
}: Props) {
  return (
    <button
      ref={launcherRef}
      data-tour="assistant"
      type="button"
      aria-label={open ? "Close assistant" : "Open assistant"}
      aria-expanded={open}
      aria-controls="tempo-assistant-panel"
      onClick={onToggle}
      className={cn(
        "fixed bottom-20 right-4 z-[90] flex size-12 items-center justify-center overflow-hidden rounded-full border border-line bg-bg-2 shadow-e3 transition-shadow duration-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice md:bottom-5 md:right-5",
        open && "glow-ice",
        "hover:glow-ice",
      )}
    >
      {open ? (
        <X className="size-5 text-text-hi" strokeWidth={1.75} />
      ) : (
        <Wordmark markOnly size={24} />
      )}
      {hasUnread && !open ? (
        <span
          aria-label="New reply"
          className="absolute right-0.5 top-0.5 size-2.5 rounded-full bg-amber"
        />
      ) : null}
    </button>
  );
}
