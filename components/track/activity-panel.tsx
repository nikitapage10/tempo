"use client";

import * as React from "react";
import {
  History,
  MessageSquare,
  Music2,
  UserPlus,
  Workflow,
} from "lucide-react";
import { useActivity } from "@/hooks/use-activity";
import { formatShortDate } from "@/lib/format";
import type { ActivityEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

type ActivityPanelProps = {
  trackId: string;
};

const EVENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  version_uploaded: Music2,
  stage_changed: Workflow,
  comment_added: MessageSquare,
  comment_replied: MessageSquare,
  collaborator_accepted: UserPlus,
};

const FILTERS = [
  { value: "all", label: "All" },
  { value: "version_uploaded", label: "Versions" },
  { value: "stage_changed", label: "Stage" },
  { value: "comment_added", label: "Comments" },
  { value: "collaborator_accepted", label: "People" },
] as const;

function eventFilterBucket(eventType: string): string {
  if (eventType.startsWith("comment")) return "comment_added";
  return eventType;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatShortDate(iso);
}

export function ActivityPanel({ trackId }: ActivityPanelProps) {
  const { data: events = [], isLoading } = useActivity(trackId);
  const [filter, setFilter] = React.useState<string>("all");

  const filtered =
    filter === "all"
      ? events
      : events.filter((e) => eventFilterBucket(e.event_type) === filter);

  return (
    <section className="rounded-card border border-line bg-bg-1 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo">
          Activity
        </h2>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-chip px-2 py-1 text-[11px] transition-colors duration-hover",
                filter === f.value
                  ? "bg-ice/15 text-ice"
                  : "text-text-lo hover:bg-bg-2 hover:text-text-hi"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-10 animate-pulse rounded-card bg-bg-2" />
          <div className="h-10 animate-pulse rounded-card bg-bg-2" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-lo">
          {events.length === 0
            ? "No activity recorded yet. Uploads, stage moves, and comments show up here."
            : "Nothing in this filter yet."}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {filtered.map((event) => (
            <ActivityRow key={event.id} event={event} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  const Icon = EVENT_ICONS[event.event_type] ?? History;
  return (
    <li className="flex items-start gap-2.5 rounded-input px-2 py-2 hover:bg-bg-2/40">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-text-lo" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-text-hi">{event.summary}</p>
        <p className="mt-0.5 font-mono text-[10px] text-text-lo">
          {timeAgo(event.created_at)}
        </p>
      </div>
    </li>
  );
}
