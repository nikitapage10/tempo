"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, GripVertical, Plus, X } from "lucide-react";
import { CalendarItemSurface } from "@/components/calendar/calendar-item-surface";
import { Button } from "@/components/ui/button";
import { formatDayHeading } from "@/lib/calendar/date";
import { itemIntersectsDay, shortDateLabel, sortItems } from "@/lib/calendar/items";
import type { CalendarItem, UnscheduledCalendarItem } from "@/lib/calendar/types";
import { cn } from "@/lib/utils";

/**
 * The glass inspector for a single day — replaces the old "+N more" jump
 * into Agenda view, and folds in the unscheduled list so it's not competing
 * for space above every view. Persistent beside the grid on ≥xl, a bottom
 * sheet below that. Natural-language / AI quick-add lives at the top of the
 * page (CalendarAiScheduler), not duplicated here.
 */
export function CalendarDayPanel({
  date,
  today,
  items,
  showSpace,
  displayTimezone,
  onActivate,
  onReschedule,
  selectedIds,
  onSelect,
  unscheduled,
  onSchedule,
  onOpenUnscheduled,
  onCreate,
  open,
  onClose,
  className,
}: {
  date: string;
  today: string;
  items: CalendarItem[];
  showSpace: boolean;
  displayTimezone: string;
  onActivate: (item: CalendarItem) => void;
  onReschedule: (item: CalendarItem, date: string) => void;
  selectedIds: Set<string>;
  onSelect: (item: CalendarItem, selected: boolean) => void;
  unscheduled: UnscheduledCalendarItem[];
  onSchedule: (item: UnscheduledCalendarItem, date: string) => void;
  onOpenUnscheduled: (href: string) => void;
  onCreate: (date: string) => void;
  /** Controls the mobile bottom-sheet visibility. Always rendered (non-collapsible) on ≥xl. */
  open: boolean;
  onClose: () => void;
  className?: string;
}) {
  const [unscheduledOpen, setUnscheduledOpen] = React.useState(false);
  const [scheduleDates, setScheduleDates] = React.useState<Record<string, string>>({});
  const reduceMotion = useReducedMotion();

  const dayItems = React.useMemo(
    () => items.filter((item) => itemIntersectsDay(item, date)).sort(sortItems),
    [items, date]
  );

  const content = (
    <div className="flex h-full flex-col">
      <div className="border-b border-line/60 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-data text-[11px] font-semibold uppercase tracking-[0.12em] text-text-lo">{shortDateLabel(date, today)}</p>
            <h2 className="truncate font-data text-base font-semibold tracking-tight text-text-hi">{formatDayHeading(date)}</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-data text-xs tabular-nums text-text-lo">{dayItems.length}</span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close day panel"
              className="rounded-input p-1 text-text-lo hover:bg-bg-2 hover:text-text-hi xl:hidden"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
        <Button type="button" size="sm" className="mt-3 w-full" onClick={() => onCreate(date)}>
          <Plus className="size-3.5" /> New event on {shortDateLabel(date, today)}
        </Button>
      </div>

      <div
        className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3"
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("text/tempo-calendar") || event.dataTransfer.types.includes("text/tempo-unscheduled")) event.preventDefault();
        }}
        onDrop={(event) => {
          const itemId = event.dataTransfer.getData("text/tempo-calendar");
          const unscheduledId = event.dataTransfer.getData("text/tempo-unscheduled");
          const item = items.find((candidate) => candidate.id === itemId);
          const pending = unscheduled.find((candidate) => candidate.id === unscheduledId);
          if (item) onReschedule(item, date);
          if (pending) onSchedule(pending, date);
        }}
      >
        {dayItems.length ? (
          dayItems.map((item) => (
            <CalendarItemSurface
              key={item.id}
              item={item}
              showSpace={showSpace}
              onActivate={onActivate}
              onDragStart={(dragged, event) => event.dataTransfer.setData("text/tempo-calendar", dragged.id)}
              selected={selectedIds.has(item.id)}
              onSelect={onSelect}
              displayTimezone={displayTimezone}
            />
          ))
        ) : (
          <p className="px-1 py-6 text-center text-sm text-text-lo">Nothing scheduled. Drop something here, or add an event above.</p>
        )}

        <div className="glass-quiet mt-1">
          <button
            type="button"
            onClick={() => setUnscheduledOpen((value) => !value)}
            aria-expanded={unscheduledOpen}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs text-text-lo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
          >
            <span>Unscheduled ({unscheduled.length})</span>
            <ChevronDown className={cn("size-3.5 transition-transform duration-hover", unscheduledOpen && "rotate-180")} />
          </button>
          {unscheduledOpen ? (
            <div className="space-y-2 border-t border-line/50 p-2">
              {unscheduled.length ? (
                unscheduled.slice(0, 50).map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData("text/tempo-unscheduled", item.id)}
                    className="well p-2"
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical className="mt-0.5 size-3.5 shrink-0 text-text-lo" />
                      <button type="button" onClick={() => onOpenUnscheduled(item.destinationHref)} className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-xs text-text-hi">{item.title}</span>
                        <span className="text-[11px] text-text-lo">{item.subtitle}</span>
                      </button>
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      <input
                        type="date"
                        value={scheduleDates[item.id] ?? ""}
                        onChange={(event) => setScheduleDates((current) => ({ ...current, [item.id]: event.target.value }))}
                        aria-label={`Schedule ${item.title}`}
                        className="h-7 min-w-0 flex-1 rounded-input border border-line bg-bg-2 px-1.5 font-mono text-[11px] text-text-hi"
                      />
                      <Button type="button" size="sm" variant="ghost" onClick={() => setScheduleDates((current) => ({ ...current, [item.id]: date }))}>
                        Today
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={!scheduleDates[item.id]}
                        onClick={() => onSchedule(item, scheduleDates[item.id])}
                      >
                        Place
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="p-2 text-xs text-text-lo">Everything has a date.</p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Persistent inspector on wide screens */}
      <aside data-tour="calendar-upcoming" className={cn("glass hidden h-full min-h-0 w-[320px] shrink-0 flex-col overflow-hidden xl:flex", className)} aria-label={`${formatDayHeading(date)} detail`}>
        {content}
      </aside>

      {/* Bottom sheet below xl */}
      <AnimatePresence>
        {open ? (
          <motion.div
            key="day-panel-sheet"
            className="fixed inset-0 z-[150] flex items-end xl:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
          >
            <button type="button" aria-label="Close day panel" className="absolute inset-0 bg-black/70" onClick={onClose} />
            <motion.div
              className="glass relative z-10 max-h-[80vh] w-full rounded-b-none"
              initial={reduceMotion ? false : { y: "100%" }}
              animate={{ y: 0 }}
              exit={reduceMotion ? undefined : { y: "100%" }}
              transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 40 }}
            >
              {content}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
