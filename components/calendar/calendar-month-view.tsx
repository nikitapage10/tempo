"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { CalendarItemSurface } from "@/components/calendar/calendar-item-surface";
import { WorkloadWarning } from "@/components/calendar/calendar-planning-panels";
import { addDateKey, formatDayHeading, formatMonthTitle, monthGridDates, monthGridStart, parseDateKey } from "@/lib/calendar/date";
import { itemIntersectsDay, sortItems } from "@/lib/calendar/items";
import type { CalendarItem, UnscheduledCalendarItem } from "@/lib/calendar/types";
import { cn } from "@/lib/utils";

export function CalendarMonthView({
  selectedDate,
  today,
  items,
  showSpace,
  displayTimezone,
  onSelectDate,
  onCreate,
  onActivate,
  onMore,
  onReschedule,
  selectedIds,
  onSelect,
  selectMode = false,
  showWeekNumbers,
  weekStartsMonday,
  unscheduled,
  onSchedule,
}: {
  selectedDate: string;
  today: string;
  items: CalendarItem[];
  showSpace: boolean;
  displayTimezone: string;
  onSelectDate: (date: string) => void;
  onCreate: (date: string) => void;
  onActivate: (item: CalendarItem) => void;
  onMore: (date: string) => void;
  onReschedule: (item: CalendarItem, date: string) => void;
  selectedIds: Set<string>;
  onSelect: (item: CalendarItem, selected: boolean) => void;
  selectMode?: boolean;
  showWeekNumbers: boolean;
  weekStartsMonday: boolean;
  unscheduled: UnscheduledCalendarItem[];
  onSchedule: (item: UnscheduledCalendarItem, date: string) => void;
}) {
  const dates = React.useMemo(() => {
    if (weekStartsMonday) return monthGridDates(selectedDate);
    const start = addDateKey(monthGridStart(selectedDate), -1);
    return Array.from({ length: 42 }, (_, index) => addDateKey(start, index));
  }, [selectedDate, weekStartsMonday]);
  const month = parseDateKey(selectedDate).getMonth();
  const byDate = React.useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const date of dates) {
      map.set(date, items.filter((item) => itemIntersectsDay(item, date)).sort(sortItems));
    }
    return map;
  }, [dates, items]);

  return (
    <section className="glass flex h-full min-h-[22rem] flex-col overflow-hidden" aria-label={formatMonthTitle(selectedDate)}>
      <div className="grid shrink-0 grid-cols-7 border-b border-line/70 bg-bg-2/20">
        {Array.from({ length: 7 }, (_, index) => {
          const labels = weekStartsMonday ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
          const label = labels[index];
          return (
            <div key={label} className="px-1 py-2 text-center font-mono text-[10px] uppercase tracking-[0.08em] text-text-lo sm:text-[11px]">
              {label}
            </div>
          );
        })}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6" role="grid">
        {dates.map((date, index) => {
          const dateItems = byDate.get(date) ?? [];
          const day = parseDateKey(date);
          const outside = day.getMonth() !== month;
          const selected = date === selectedDate;
          const isToday = date === today;
          const visible = dateItems.slice(0, 3);
          return (
            <div
              key={date}
              role="gridcell"
              aria-selected={selected}
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
              className={cn(
                "group relative min-h-0 min-w-0 overflow-hidden border-line/70 p-1 sm:p-1.5",
                index % 7 !== 6 && "border-r",
                index < 35 && "border-b",
                selected && "bg-bg-2/45",
                outside && "bg-bg-0/25"
              )}
            >
              <div className="mb-1 flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={() => onSelectDate(date)}
                  aria-label={formatDayHeading(date)}
                  className={cn(
                    "relative flex size-6 items-center justify-center rounded-input font-mono text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice sm:text-xs",
                    outside ? "text-text-lo/45" : "text-text-lo",
                    isToday && "text-ice",
                    selected && "bg-bg-2 text-text-hi"
                  )}
                >
                  {showWeekNumbers && index % 7 === 0 ? (
                    <span className="absolute left-0.5 top-0.5 text-[7px] text-text-lo/45">W{Math.ceil((Number(date.slice(8)) + parseDateKey(date).getDay()) / 7)}</span>
                  ) : null}
                  {isToday ? <span className="absolute bottom-0.5 size-1 rounded-full bg-ice" /> : null}
                  {day.getDate()}
                </button>
                <WorkloadWarning date={date} count={dateItems.length} />
                <button
                  type="button"
                  onClick={() => onCreate(date)}
                  className="flex size-6 items-center justify-center rounded-input text-text-lo/40 opacity-0 transition-opacity duration-hover hover:bg-bg-2 hover:text-ice focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice group-hover:opacity-100"
                  aria-label={`New event on ${formatDayHeading(date)}`}
                >
                  <Plus className="size-3" />
                </button>
              </div>
              <div className="min-h-0 min-w-0 space-y-1">
                {visible.map((item) => (
                  <CalendarItemSurface
                    key={`${date}:${item.id}`}
                    item={item}
                    compact
                    showSpace={showSpace}
                    onActivate={onActivate}
                    onDragStart={(dragged, event) => event.dataTransfer.setData("text/tempo-calendar", dragged.id)}
                    selected={selectedIds.has(item.id)}
                    onSelect={onSelect}
                    displayTimezone={displayTimezone}
                    selectMode={selectMode}
                  />
                ))}
                {dateItems.length > visible.length ? (
                  <button
                    type="button"
                    onClick={() => onMore(date)}
                    className="block w-full truncate px-1 text-left text-[11px] text-text-lo hover:text-ice focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
                  >
                    +{dateItems.length - visible.length} more
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
