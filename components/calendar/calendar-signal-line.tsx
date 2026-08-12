"use client";

import * as React from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { addDateKey } from "@/lib/calendar/date";
import type { CalendarItem, UnscheduledCalendarItem } from "@/lib/calendar/types";
import { cn } from "@/lib/utils";

type Signals = {
  upcoming: number;
  overdue: number;
  unscheduled: number;
  overloadedDays: number;
  riskyReleases: number;
  participantConflicts: number;
  headline: string | null;
};

function computeSignals(items: CalendarItem[], unscheduled: UnscheduledCalendarItem[], today: string): Signals {
  const nextWeek = addDateKey(today, 8);
  const upcoming = items.filter((item) => item.date >= today && item.date < nextWeek);
  const overdue = items.filter((item) => item.state === "overdue");
  const dayLoads = new Map<string, number>();
  upcoming.forEach((item) => dayLoads.set(item.date, (dayLoads.get(item.date) ?? 0) + 1));
  const overloaded = Array.from(dayLoads).filter(([, count]) => count >= 5);
  const releaseDates = items.filter((item) => item.source === "release_date");
  const risky = releaseDates.filter((release) => {
    const pitch = items.find((item) => item.source === "pitching_deadline" && item.sourceId === release.sourceId);
    return !pitch || Math.round((new Date(`${release.date}T12:00:00`).getTime() - new Date(`${pitch.date}T12:00:00`).getTime()) / 86400000) < 14;
  });
  const participantConflicts = new Set<string>();
  const participantSlots = new Map<string, string>();
  items.forEach((item) =>
    item.event?.participants.forEach((participant) => {
      const key = `${item.date}:${participant.toLowerCase()}`;
      if (participantSlots.has(key)) participantConflicts.add(key);
      else participantSlots.set(key, item.id);
    })
  );

  let headline: string | null = null;
  const parts: string[] = [];
  if (overdue.length) parts.push(`${overdue.length} overdue`);
  if (overloaded.length) parts.push(`${overloaded.length} heavy day${overloaded.length === 1 ? "" : "s"}`);
  if (risky.length) parts.push(`${risky.length} pitching risk${risky.length === 1 ? "" : "s"}`);
  if (participantConflicts.size) parts.push(`${participantConflicts.size} double-booking${participantConflicts.size === 1 ? "" : "s"}`);
  if (parts.length) headline = parts.join(" · ");

  return {
    upcoming: upcoming.length,
    overdue: overdue.length,
    unscheduled: unscheduled.length,
    overloadedDays: overloaded.length,
    riskyReleases: risky.length,
    participantConflicts: participantConflicts.size,
    headline,
  };
}

/**
 * Collapses what used to be four always-on stat tiles into a single line
 * that only appears when there's something worth flagging. Click to expand
 * the full tile breakdown.
 */
export function CalendarSignalLine({
  items,
  unscheduled,
  today,
}: {
  items: CalendarItem[];
  unscheduled: UnscheduledCalendarItem[];
  today: string;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const signals = React.useMemo(() => computeSignals(items, unscheduled, today), [items, unscheduled, today]);

  if (!signals.headline) return null;

  return (
    <div className="glass-quiet overflow-hidden" aria-label="Calendar signals">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-warn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
      >
        <AlertTriangle className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{signals.headline}</span>
        <ChevronDown className={cn("size-3.5 shrink-0 text-text-lo transition-transform duration-hover", expanded && "rotate-180")} />
      </button>
      {expanded ? (
        <div className="grid gap-2 border-t border-line/50 p-3 sm:grid-cols-4">
          {[
            ["Next 7 days", signals.upcoming, "Scheduled items"],
            ["Overdue", signals.overdue, signals.overdue ? "Needs attention" : "Clear"],
            ["Unscheduled", signals.unscheduled, "Ready to place"],
            [
              "Planning signals",
              signals.overloadedDays + signals.riskyReleases + signals.participantConflicts,
              signals.overloadedDays
                ? `${signals.overloadedDays} heavy day(s)`
                : signals.participantConflicts
                  ? `${signals.participantConflicts} availability conflict(s)`
                  : signals.riskyReleases
                    ? `${signals.riskyReleases} release risk(s)`
                    : "Schedule balanced",
            ],
          ].map(([label, value, note]) => (
            <div key={label as string} className="well px-3 py-2">
              <p className="label-mono text-text-lo">{label}</p>
              <p className={cn("mt-1 text-xl font-semibold tabular-nums", Number(value) ? "text-text-hi" : "text-ok")}>{value}</p>
              <p className="text-xs text-text-lo">{note}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
