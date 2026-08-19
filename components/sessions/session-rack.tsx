"use client";

import * as React from "react";
import { CheckSquare, Gavel, History, ListChecks, MessageCircle, NotebookPen, Pin } from "lucide-react";
import { cn } from "@/lib/utils";

export type SessionRackTab = "agenda" | "notes" | "tasks" | "pinned" | "decisions" | "history" | "chat";

const TABS: Array<{ id: SessionRackTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "agenda", label: "Agenda", icon: ListChecks },
  { id: "notes", label: "Notes", icon: NotebookPen },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "pinned", label: "Pinned", icon: Pin },
  { id: "decisions", label: "Decisions", icon: Gavel },
  { id: "history", label: "Past sessions", icon: History },
  { id: "chat", label: "Chat", icon: MessageCircle },
];

export function SessionRack({
  panels,
  counts,
  className,
}: {
  panels: Record<SessionRackTab, React.ReactNode>;
  counts?: Partial<Record<SessionRackTab, number>>;
  className?: string;
}) {
  const [tab, setTab] = React.useState<SessionRackTab>("agenda");
  return (
    <section className={cn("panel-quiet flex min-h-0 flex-col overflow-hidden", className)}>
      <div role="tablist" aria-label="Session rack" className="flex shrink-0 gap-1 overflow-x-auto border-b border-line/70 bg-bg-0/25 p-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls={`session-rack-${id}`}
            onClick={() => setTab(id)}
            className={cn(
              "group inline-flex shrink-0 items-center gap-1.5 rounded-chip px-3 py-1.5 text-xs font-medium transition-colors duration-hover",
              id === "chat" && "lg:hidden",
              tab === id ? "bg-bg-2 text-ice shadow-e1" : "text-text-lo hover:bg-bg-2/50 hover:text-text-hi",
            )}
          >
            <Icon className="size-3.5" />
            {label}
            {counts?.[id] ? <span className="rounded-chip bg-bg-0/60 px-1.5 font-data text-[10px]">{counts[id]}</span> : null}
          </button>
        ))}
      </div>
      <div id={`session-rack-${tab}`} role="tabpanel" className="min-h-0 flex-1 overflow-y-auto p-4">
        {panels[tab]}
      </div>
    </section>
  );
}
