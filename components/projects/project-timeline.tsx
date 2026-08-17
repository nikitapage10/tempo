"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type ProjectTimelineEvent = {
  key: string;
  date: string;
  label: string;
  detail?: string;
  status: "done" | "upcoming" | "overdue";
};

const STATUS_DOT: Record<ProjectTimelineEvent["status"], string> = {
  done: "bg-ok",
  upcoming: "bg-ice",
  overdue: "bg-warn",
};

/** Chronological rail of a project's milestones — created, release/pitching dates, task due dates, deadline. */
export function ProjectTimeline({ events }: { events: ProjectTimelineEvent[] }) {
  const sorted = React.useMemo(() => [...events].sort((a, b) => (a.date < b.date ? -1 : 1)), [events]);

  if (!sorted.length) return null;

  return (
    <section className="panel-quiet p-5">
      <h2 className="label-mono mb-4">Timeline</h2>
      <ol className="relative space-y-4 pl-6">
        <span aria-hidden className="absolute bottom-2 left-[7px] top-2 w-px bg-line" />
        {sorted.map((event) => (
          <li key={event.key} className="relative">
            <span
              aria-hidden
              className={cn("absolute -left-6 top-1 size-3 rounded-full border-2 border-bg-0", STATUS_DOT[event.status])}
            />
            <div className="flex items-baseline gap-2">
              <span className={cn("text-sm", event.status === "overdue" ? "text-warn" : "text-text-hi")}>{event.label}</span>
              <span className="font-data text-xs tabular-nums text-text-lo">
                {new Date(`${event.date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            </div>
            {event.detail ? <p className="text-xs text-text-lo">{event.detail}</p> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
