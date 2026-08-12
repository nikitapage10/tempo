"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, FolderPlus, Plus, Search, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeaderMenu } from "@/components/ui/header-menu";
import type { CalendarView } from "@/components/calendar/use-calendar-view-state";
import { formatDayHeading, formatMonthTitle, utcOffsetLabel } from "@/lib/calendar/date";
import { cn } from "@/lib/utils";

const VIEW_OPTIONS: { value: CalendarView; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "agenda", label: "Agenda" },
  { value: "timeline", label: "Timeline" },
];

export function CalendarToolbar({
  view,
  onViewChange,
  selectedDate,
  rangeStart,
  rangeEndExclusive,
  today,
  onMovePeriod,
  onToday,
  search,
  onSearchChange,
  displayTimezone,
  browserTimezone,
  onNewEvent,
  onNewMilestone,
  onReleasePlan,
  releasePlanEnabled,
  createDisabled,
  filtersSlot,
  overflowSlot,
}: {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  selectedDate: string;
  rangeStart: string;
  rangeEndExclusive: string;
  today: string;
  onMovePeriod: (delta: number) => void;
  onToday: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  displayTimezone: string;
  browserTimezone: string;
  onNewEvent: () => void;
  onNewMilestone: () => void;
  onReleasePlan: () => void;
  releasePlanEnabled: boolean;
  createDisabled: boolean;
  filtersSlot: React.ReactNode;
  overflowSlot: React.ReactNode;
}) {
  const [searchOpen, setSearchOpen] = React.useState(false);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();

  React.useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const title =
    view === "month"
      ? formatMonthTitle(selectedDate)
      : view === "week"
        ? `${formatDayHeading(rangeStart)} – ${formatDayHeading(new Date(new Date(rangeEndExclusive).getTime() - 86400000).toISOString().slice(0, 10))}`
        : `${formatDayHeading(rangeStart)} – ${formatDayHeading(new Date(new Date(rangeEndExclusive).getTime() - 86400000).toISOString().slice(0, 10))}`;

  return (
    <div className="glass px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1">
          <Button type="button" size="icon" variant="ghost" onClick={() => onMovePeriod(-1)} aria-label={view === "month" ? "Previous month" : view === "week" ? "Previous week" : "Previous period"}>
            <ChevronLeft />
          </Button>
          <Button type="button" size="icon" variant="ghost" onClick={() => onMovePeriod(1)} aria-label={view === "month" ? "Next month" : view === "week" ? "Next week" : "Next period"}>
            <ChevronRight />
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={onToday}>
            Today
          </Button>
          <h2 className="ml-1 min-w-0 overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={title}
                initial={reduceMotion ? false : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: 4 }}
                transition={{ duration: 0.16 }}
                className="block truncate font-data text-base font-semibold tracking-tight text-text-hi sm:text-lg"
              >
                {title}
              </motion.span>
            </AnimatePresence>
          </h2>
          {displayTimezone !== browserTimezone ? (
            <span className="glass-chip hidden shrink-0 px-2 py-0.5 font-mono text-[11px] text-text-lo sm:inline-flex" title={`Calendar is showing times in ${displayTimezone}`}>
              {utcOffsetLabel(displayTimezone)} · {displayTimezone.split("/").pop()?.replaceAll("_", " ")}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex rounded-input border border-line bg-bg-2/60 p-0.5">
            {VIEW_OPTIONS.map((option) => (
              <button
                type="button"
                key={option.value}
                onClick={() => onViewChange(option.value)}
                className={cn(
                  "relative rounded-[6px] px-2.5 py-1.5 text-xs capitalize transition-colors duration-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice",
                  view === option.value ? "text-ice" : "text-text-lo hover:text-text-hi"
                )}
              >
                {view === option.value ? (
                  <motion.span
                    layoutId="calendar-view-pill"
                    className="absolute inset-0 rounded-[6px] bg-bg-1 shadow-e1"
                    transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 34 }}
                  />
                ) : null}
                <span className="relative">{option.label}</span>
              </button>
            ))}
          </div>

          {searchOpen ? (
            <span className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2 size-3.5 text-text-lo" />
              <input
                ref={searchRef}
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                onBlur={() => {
                  if (!search) setSearchOpen(false);
                }}
                placeholder="Search schedule"
                className="h-8 w-[160px] rounded-input border border-line bg-bg-2 pl-8 pr-2 text-xs text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice sm:w-[220px]"
              />
            </span>
          ) : (
            <Button type="button" size="icon" variant="ghost" aria-label="Search schedule" onClick={() => setSearchOpen(true)}>
              <Search className="size-4" />
            </Button>
          )}

          {filtersSlot}

          <HeaderMenu label="New" panelWidth={220}>
            <button type="button" onClick={onNewEvent} disabled={createDisabled} className="flex items-center gap-2 rounded-input px-2 py-1.5 text-left text-xs text-text-hi hover:bg-bg-2 disabled:opacity-40">
              <Plus className="size-3.5" /> Event
            </button>
            <button type="button" onClick={onNewMilestone} disabled={createDisabled} className="flex items-center gap-2 rounded-input px-2 py-1.5 text-left text-xs text-text-hi hover:bg-bg-2 disabled:opacity-40">
              <FolderPlus className="size-3.5" /> Milestone
            </button>
            <button type="button" onClick={onReleasePlan} disabled={!releasePlanEnabled} className="flex items-center gap-2 rounded-input px-2 py-1.5 text-left text-xs text-text-hi hover:bg-bg-2 disabled:opacity-40">
              <WandSparkles className="size-3.5" /> Generate release plan
            </button>
          </HeaderMenu>

          {overflowSlot}
        </div>
      </div>
    </div>
  );
}
