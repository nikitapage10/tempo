"use client";

import {
  CalendarDays,
  Check,
  CheckSquare,
  Clock,
  FolderKanban,
  Music2,
  Rocket,
  Send,
  TriangleAlert,
} from "lucide-react";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { timeInTimeZone } from "@/lib/calendar/date";
import type { CalendarItem } from "@/lib/calendar/types";
import { cn } from "@/lib/utils";

type SpotlightTone = "ramp" | "ice" | "amber" | "violet" | "ok" | "warn";

function presentation(item: CalendarItem): {
  tone: SpotlightTone;
  label: string;
  Icon: typeof CalendarDays;
} {
  if (item.state === "overdue" || item.state === "blocked") {
    return {
      tone: "warn",
      label: item.state === "overdue" ? "Overdue" : "Blocked",
      Icon: TriangleAlert,
    };
  }
  if (item.state === "completed") {
    return { tone: "ok", label: "Done", Icon: Check };
  }
  switch (item.source) {
    case "task_due":
      return { tone: "ice", label: "Task", Icon: CheckSquare };
    case "track_deadline":
      return { tone: "ramp", label: "Target", Icon: Music2 };
    case "track_next_action":
      return { tone: "ramp", label: "Next", Icon: Music2 };
    case "project_deadline":
      return { tone: "amber", label: "Project", Icon: FolderKanban };
    case "release_date":
      return { tone: "amber", label: "Release", Icon: Rocket };
    case "pitching_deadline":
      return { tone: "amber", label: "Pitching", Icon: Send };
    default:
      return { tone: "violet", label: "Event", Icon: CalendarDays };
  }
}

function timeLabel(item: CalendarItem) {
  if (item.allDay || !item.startsAt) return null;
  return timeInTimeZone(item.startsAt, item.timezone || "UTC");
}

export function CalendarItemSurface({
  item,
  compact = false,
  showSpace = false,
  onActivate,
}: {
  item: CalendarItem;
  compact?: boolean;
  showSpace?: boolean;
  onActivate: (item: CalendarItem) => void;
}) {
  const { tone, label, Icon } = presentation(item);
  const time = timeLabel(item);
  const accessible = [
    item.title,
    label,
    time,
    item.state === "overdue" ? "overdue" : null,
    item.state === "blocked" ? "blocked" : null,
    showSpace ? item.spaceLabel : null,
  ]
    .filter(Boolean)
    .join(", ");

  if (compact) {
    return (
      <SpotlightCard tone={tone} radius={7} borderWidth={1} size={110}>
        <button
          type="button"
          onClick={() => onActivate(item)}
          aria-label={accessible}
          className={cn(
            "relative flex h-7 w-full min-w-0 items-center gap-1 rounded-[6px] border border-line bg-gradient-to-b from-[#17171e] to-bg-1 px-1.5 text-left shadow-e1 transition-shadow duration-hover hover:shadow-e2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice",
            item.state === "completed" && "opacity-60"
          )}
        >
          <Icon className="size-3 shrink-0" aria-hidden />
          {time ? (
            <span className="shrink-0 font-mono text-[9px] text-text-lo">
              {time}
            </span>
          ) : null}
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-[10px] text-text-hi",
              item.state === "completed" && "line-through"
            )}
          >
            {item.title}
          </span>
        </button>
      </SpotlightCard>
    );
  }

  return (
    <SpotlightCard
      as="article"
      tone={tone}
      radius={10}
      size={180}
      className="rounded-card"
    >
      <button
        type="button"
        onClick={() => onActivate(item)}
        aria-label={accessible}
        className={cn(
          "relative flex w-full items-start gap-3 rounded-card border border-line bg-bg-1 px-3 py-3 text-left shadow-e1 transition-shadow duration-hover hover:shadow-e2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice",
          item.state === "completed" && "opacity-60"
        )}
      >
        <span
          className={cn(
            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-input border border-line bg-bg-2",
            tone === "amber" && "text-amber",
            tone === "violet" && "text-violet",
            tone === "warn" && "text-warn",
            tone === "ok" && "text-ok",
            (tone === "ice" || tone === "ramp") && "text-ice"
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={cn(
                "min-w-0 truncate text-sm font-medium text-text-hi",
                item.state === "completed" && "line-through"
              )}
            >
              {item.title}
            </span>
            {time ? (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-text-lo">
                <Clock className="size-3" />
                {time}
              </span>
            ) : null}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-text-lo">
            <span
              className={cn(
                "rounded-chip border px-1.5 py-0.5 font-mono uppercase tracking-wide",
                tone === "warn"
                  ? "border-warn/30 bg-warn/10 text-warn"
                  : tone === "amber"
                    ? "border-amber/30 bg-amber/10 text-amber"
                    : tone === "violet"
                      ? "border-violet/30 bg-violet/10 text-violet"
                      : "border-ice/25 bg-ice/10 text-ice"
              )}
            >
              {label}
            </span>
            {item.subtitle ? <span>{item.subtitle}</span> : null}
            {showSpace ? <span>· {item.spaceLabel}</span> : null}
          </span>
        </span>
      </button>
    </SpotlightCard>
  );
}

