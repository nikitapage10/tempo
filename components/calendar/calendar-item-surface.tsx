"use client";

import {
  CalendarDays,
  Check,
  CheckSquare,
  Clock,
  FolderKanban,
  Globe2,
  Music2,
  Rocket,
  Send,
  TriangleAlert,
} from "lucide-react";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { useCalendarCategoryPalette } from "@/components/calendar/calendar-category-provider";
import { categoryKeyForItem } from "@/lib/calendar/categories";
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
    default: {
      const eventLabel: Record<string, string> = {
        studio_session: "Studio",
        meeting: "Meeting",
        content: "Content",
        live_show: "Live / show",
        personal: "Personal",
        milestone: "Milestone",
        other: "Event",
      };
      return {
        tone: "violet",
        label: eventLabel[item.event?.kind ?? "other"] ?? "Event",
        Icon: CalendarDays,
      };
    }
  }
}

function timeLabel(item: CalendarItem, displayTimezone?: string) {
  if (item.allDay || !item.startsAt) return null;
  return timeInTimeZone(item.startsAt, displayTimezone || item.timezone || "UTC");
}

/** True when the item has its own stored timezone and it differs from the calendar's display zone. */
function isCrossTimezone(item: CalendarItem, displayTimezone?: string) {
  return !!(item.timezone && displayTimezone && !item.allDay && item.timezone !== displayTimezone);
}

function categorySurfaceStyle(
  color: string | undefined,
  compact: boolean
): React.CSSProperties | undefined {
  if (!color) return undefined;
  const borderColor = `color-mix(in srgb, ${color} 32%, var(--line))`;
  if (compact) {
    return {
      borderColor,
      backgroundImage: `linear-gradient(180deg, color-mix(in srgb, ${color} 14%, rgb(var(--bg-1-rgb) / 0.72)), color-mix(in srgb, ${color} 9%, rgb(var(--bg-1-rgb) / 0.62)))`,
    };
  }
  return {
    borderColor,
    backgroundColor: `color-mix(in srgb, ${color} 9%, rgb(var(--bg-1-rgb) / 0.72))`,
  };
}

export function CalendarItemSurface({
  item,
  compact = false,
  showSpace = false,
  onActivate,
  onDragStart,
  selected = false,
  onSelect,
  displayTimezone,
  selectMode = false,
}: {
  item: CalendarItem;
  compact?: boolean;
  showSpace?: boolean;
  onActivate: (item: CalendarItem) => void;
  onDragStart?: (item: CalendarItem, event: React.DragEvent) => void;
  selected?: boolean;
  onSelect?: (item: CalendarItem, selected: boolean) => void;
  /** The calendar's chosen display timezone — when set and different from the item's own, times are shown converted plus a globe hint. */
  displayTimezone?: string;
  /** When true, a plain click on a compact (month/week) item toggles selection instead of requiring Ctrl/Cmd — the discoverable form of multi-select. */
  selectMode?: boolean;
}) {
  const categories = useCalendarCategoryPalette();
  const base = presentation(item);
  const category = categories.find(
    (candidate) => candidate.key === categoryKeyForItem(item.source, item.event?.kind)
  );
  const tone = base.tone;
  const label =
    item.state === "overdue" || item.state === "blocked" || item.state === "completed"
      ? base.label
      : category?.label ?? base.label;
  const color =
    item.state === "overdue" || item.state === "blocked"
      ? "#ef6b73"
      : item.state === "completed"
        ? "#74d6a0"
        : category?.color;
  const Icon = base.Icon;
  const time = timeLabel(item, displayTimezone);
  const crossZone = isCrossTimezone(item, displayTimezone);
  const surfaceStyle = categorySurfaceStyle(color, compact);
  const accessible = [
    item.title,
    label,
    time,
    crossZone ? `originally scheduled in ${item.timezone}` : null,
    item.state === "overdue" ? "overdue" : null,
    item.state === "blocked" ? "blocked" : null,
    showSpace ? item.spaceLabel : null,
  ]
    .filter(Boolean)
    .join(", ");

  if (compact) {
    return (
      <SpotlightCard tone={tone} accent={color} radius={7} borderWidth={1} size={110}>
        <button
          type="button"
          draggable={!!onDragStart}
          onDragStart={(event) => onDragStart?.(item, event)}
          onClick={(event) => {
            if (onSelect && (selectMode || event.ctrlKey || event.metaKey)) onSelect(item, !selected);
            else onActivate(item);
          }}
          aria-label={accessible}
          style={surfaceStyle}
          className={cn(
            "relative flex h-7 w-full min-w-0 items-center gap-1 rounded-[6px] border border-line bg-bg-1/70 px-1.5 text-left shadow-e1 backdrop-blur-sm transition-shadow duration-hover hover:shadow-e2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice",
            item.state === "completed" && "opacity-60",
            selected && "ring-2 ring-ice"
          )}
        >
          <Icon className="size-3 shrink-0" style={{ color }} aria-hidden />
          {time ? (
            <span className="inline-flex shrink-0 items-center gap-0.5 font-mono text-[10px] text-text-lo">
              {time}
              {crossZone ? <Globe2 className="size-2.5" aria-hidden /> : null}
            </span>
          ) : null}
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-[11px] text-text-hi",
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
      accent={color}
      radius={10}
      size={180}
      className="rounded-card"
    >
      <div
        draggable={!!onDragStart}
        onDragStart={(event) => onDragStart?.(item, event)}
        style={surfaceStyle}
        className={cn(
          "relative flex w-full items-start gap-3 rounded-card border border-line bg-bg-1/75 px-3 py-3 text-left shadow-e1 backdrop-blur-sm transition-shadow duration-hover hover:shadow-e2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice",
          item.state === "completed" && "opacity-60",
          selected && "ring-2 ring-ice"
        )}
      >
        <button type="button" onClick={() => onActivate(item)} aria-label={accessible} className="flex min-w-0 flex-1 items-start gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"><span
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-input border border-line bg-bg-2"
          style={{ color, borderColor: color ? `color-mix(in srgb, ${color} 32%, transparent)` : undefined }}
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
              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-text-lo" title={crossZone ? `Originally scheduled in ${item.timezone}` : undefined}>
                <Clock className="size-3" />
                {time}
                {crossZone ? <Globe2 className="size-3 text-violet" aria-hidden /> : null}
              </span>
            ) : null}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-text-lo">
            <span
              className="rounded-chip border px-1.5 py-0.5 font-mono uppercase tracking-wide"
              style={color ? { color, borderColor: `color-mix(in srgb, ${color} 35%, transparent)`, backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)` } : undefined}
            >
              {label}
            </span>
            {item.subtitle ? <span>{item.subtitle}</span> : null}
            {showSpace ? <span>· {item.spaceLabel}</span> : null}
          </span>
        </span></button>
        {onSelect ? <input type="checkbox" checked={selected} onClick={(event) => event.stopPropagation()} onChange={(event) => onSelect(item, event.target.checked)} aria-label={`Select ${item.title}`} className="mt-1 size-4 shrink-0 accent-[var(--ice)]" /> : null}
      </div>
    </SpotlightCard>
  );
}

/**
 * Vertical block for the week time grid — positioned absolutely by the
 * caller (top/height/left/width in `style`), sized by duration rather than
 * a fixed row height.
 */
export function CalendarTimedItemSurface({
  item,
  style,
  onActivate,
  onDragStart,
  displayTimezone,
  dense = false,
}: {
  item: CalendarItem;
  style: React.CSSProperties;
  onActivate: (item: CalendarItem) => void;
  onDragStart?: (item: CalendarItem, event: React.DragEvent) => void;
  displayTimezone?: string;
  /** Compact label when the block is short (< ~40px tall). */
  dense?: boolean;
}) {
  const categories = useCalendarCategoryPalette();
  const base = presentation(item);
  const category = categories.find(
    (candidate) => candidate.key === categoryKeyForItem(item.source, item.event?.kind)
  );
  const color =
    item.state === "overdue" || item.state === "blocked"
      ? "#ef6b73"
      : item.state === "completed"
        ? "#74d6a0"
        : category?.color;
  const Icon = base.Icon;
  const time = timeLabel(item, displayTimezone);
  const crossZone = isCrossTimezone(item, displayTimezone);
  const surfaceStyle = categorySurfaceStyle(color, true);

  return (
    <button
      type="button"
      draggable={!!onDragStart}
      onDragStart={(event) => onDragStart?.(item, event)}
      onClick={() => onActivate(item)}
      aria-label={[item.title, time, crossZone ? `originally in ${item.timezone}` : null].filter(Boolean).join(", ")}
      style={{ ...style, ...surfaceStyle }}
      className={cn(
        "absolute overflow-hidden rounded-[7px] border border-line bg-bg-1/75 px-1.5 py-1 text-left shadow-e1 backdrop-blur-sm transition-shadow duration-hover hover:z-10 hover:shadow-e2 focus-visible:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ice",
        item.state === "completed" && "opacity-60"
      )}
    >
      <span className="flex items-center gap-1">
        <Icon className="size-3 shrink-0" style={{ color }} aria-hidden />
        {time ? (
          <span className="inline-flex shrink-0 items-center gap-0.5 truncate font-mono text-[10px] text-text-lo">
            {time}
            {crossZone ? <Globe2 className="size-2.5" aria-hidden /> : null}
          </span>
        ) : null}
      </span>
      {!dense ? (
        <span
          className={cn(
            "block truncate text-xs font-medium text-text-hi",
            item.state === "completed" && "line-through"
          )}
        >
          {item.title}
        </span>
      ) : null}
    </button>
  );
}
