"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { CalendarItemSurface, CalendarTimedItemSurface } from "@/components/calendar/calendar-item-surface";
import { WorkloadWarning } from "@/components/calendar/calendar-planning-panels";
import {
  formatDayHeading,
  formatShortWeekday,
  minutesFromMidnight,
  parseDateKey,
  weekDates,
} from "@/lib/calendar/date";
import { itemIntersectsDay, sortItems } from "@/lib/calendar/items";
import type { CalendarItem, UnscheduledCalendarItem } from "@/lib/calendar/types";
import { cn } from "@/lib/utils";

const HOUR_HEIGHT = 48;
const FULL_DAY_START = 0;
const DEFAULT_DAY_START = 6;
const DAY_END = 24;
const MINUTE_STEP = 15;

function snapMinutes(minutes: number) {
  return Math.max(0, Math.min(24 * 60 - MINUTE_STEP, Math.round(minutes / MINUTE_STEP) * MINUTE_STEP));
}

function minutesToTime(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Greedy interval-graph column packing for one day's timed items, so overlaps sit side by side instead of stacking. */
export function layoutColumns(items: { id: string; start: number; end: number }[]) {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end);
  const columnEnds: number[] = [];
  const placement = new Map<string, number>();
  for (const it of sorted) {
    let col = columnEnds.findIndex((end) => end <= it.start);
    if (col === -1) {
      col = columnEnds.length;
      columnEnds.push(it.end);
    } else {
      columnEnds[col] = it.end;
    }
    placement.set(it.id, col);
  }
  return { placement, totalCols: Math.max(1, columnEnds.length) };
}

export function CalendarWeekView({
  selectedDate,
  today,
  items,
  showSpace,
  displayTimezone,
  weekStartsMonday,
  onSelectDate,
  onCreate,
  onActivate,
  onReschedule,
  selectedIds,
  onSelect,
  selectMode = false,
  unscheduled,
  onSchedule,
}: {
  selectedDate: string;
  today: string;
  items: CalendarItem[];
  showSpace: boolean;
  displayTimezone: string;
  weekStartsMonday: boolean;
  onSelectDate: (date: string) => void;
  onCreate: (date: string, time?: string) => void;
  onActivate: (item: CalendarItem) => void;
  onReschedule: (item: CalendarItem, date: string, time?: string) => void;
  selectedIds: Set<string>;
  onSelect: (item: CalendarItem, selected: boolean) => void;
  selectMode?: boolean;
  unscheduled: UnscheduledCalendarItem[];
  onSchedule: (item: UnscheduledCalendarItem, date: string) => void;
}) {
  const [showEarlyHours, setShowEarlyHours] = React.useState(false);
  const dayStart = showEarlyHours ? FULL_DAY_START : DEFAULT_DAY_START;
  const dates = React.useMemo(() => weekDates(selectedDate, weekStartsMonday), [selectedDate, weekStartsMonday]);
  const hours = React.useMemo(
    () => Array.from({ length: DAY_END - dayStart }, (_, index) => dayStart + index),
    [dayStart]
  );

  const [nowMinutes, setNowMinutes] = React.useState<number | null>(null);
  React.useEffect(() => {
    const tick = () => setNowMinutes(minutesFromMidnight(new Date().toISOString(), displayTimezone));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [displayTimezone]);

  const byDate = React.useMemo(() => {
    const map = new Map<string, { allDay: CalendarItem[]; timed: CalendarItem[] }>();
    for (const date of dates) {
      const dayItems = items.filter((item) => itemIntersectsDay(item, date)).sort(sortItems);
      map.set(date, {
        allDay: dayItems.filter((item) => item.allDay || !item.startsAt),
        timed: dayItems.filter((item) => !item.allDay && item.startsAt),
      });
    }
    return map;
  }, [dates, items]);

  function handleDrop(event: React.DragEvent, date: string, time?: string) {
    const itemId = event.dataTransfer.getData("text/tempo-calendar");
    const unscheduledId = event.dataTransfer.getData("text/tempo-unscheduled");
    const item = items.find((candidate) => candidate.id === itemId);
    const pending = unscheduled.find((candidate) => candidate.id === unscheduledId);
    if (item) onReschedule(item, date, time);
    if (pending) onSchedule(pending, date);
  }

  function acceptDrag(event: React.DragEvent) {
    if (
      event.dataTransfer.types.includes("text/tempo-calendar") ||
      event.dataTransfer.types.includes("text/tempo-unscheduled")
    ) {
      event.preventDefault();
    }
  }

  return (
    <section className="glass overflow-hidden" aria-label={`Week of ${formatDayHeading(dates[0])}`}>
    <div className="overflow-x-auto">
    <div className="min-w-[836px]">
      <div className="grid grid-cols-[52px_repeat(7,minmax(112px,1fr))] border-b border-line/70">
        <div className="border-r border-line/70" />
        {dates.map((date) => {
          const isToday = date === today;
          const selected = date === selectedDate;
          const dayItems = byDate.get(date);
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelectDate(date)}
              className={cn(
                "flex flex-col items-center gap-0.5 border-r border-line/70 px-1 py-2 text-center last:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice",
                selected && "bg-bg-2/45"
              )}
            >
              <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-text-lo">{formatShortWeekday(date)}</span>
              <span className={cn("flex size-6 items-center justify-center rounded-input font-mono text-xs", isToday ? "bg-ice/15 text-ice" : "text-text-hi")}>
                {parseDateKey(date).getDate()}
              </span>
              {dayItems ? <WorkloadWarning date={date} count={dayItems.allDay.length + dayItems.timed.length} /> : null}
            </button>
          );
        })}
      </div>

      {/* All-day row — task due dates, deadlines, releases, and all-day events have no clock time and never sit on the hour axis. */}
      <div className="grid grid-cols-[52px_repeat(7,minmax(112px,1fr))] border-b border-line/70 bg-bg-2/20">
        <div className="flex items-center justify-end border-r border-line/70 px-1.5 py-1.5">
          <span className="font-mono text-[8px] uppercase text-text-lo/60">All day</span>
        </div>
        {dates.map((date) => (
          <div
            key={date}
            onDragOver={acceptDrag}
            onDrop={(event) => handleDrop(event, date)}
            className="min-h-[36px] space-y-1 border-r border-line/70 p-1 last:border-r-0"
          >
            {(byDate.get(date)?.allDay ?? []).map((item) => (
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
          </div>
        ))}
      </div>

      {!showEarlyHours ? (
        <button
          type="button"
          onClick={() => setShowEarlyHours(true)}
          className="w-full border-b border-line/70 py-1 text-center text-[10px] text-text-lo hover:text-ice focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
        >
          Show earlier hours
        </button>
      ) : null}

      <div className="max-h-[640px] overflow-y-auto">
        <div className="relative grid grid-cols-[52px_repeat(7,minmax(112px,1fr))]" style={{ height: hours.length * HOUR_HEIGHT }}>
          {/* Hour gutter */}
          <div className="relative border-r border-line/70">
            {hours.map((hour) => (
              <div key={hour} style={{ height: HOUR_HEIGHT }} className="border-b border-line/40 pr-1.5 text-right">
                <span className="relative -top-2 font-mono text-[9px] text-text-lo/70">
                  {hour === 0 ? "12a" : hour < 12 ? `${hour}a` : hour === 12 ? "12p" : `${hour - 12}p`}
                </span>
              </div>
            ))}
          </div>

          {dates.map((date) => {
            const timed = byDate.get(date)?.timed ?? [];
            const withMinutes = timed.map((item) => ({
              item,
              start: minutesFromMidnight(item.startsAt!, displayTimezone),
              end: Math.max(
                minutesFromMidnight(item.startsAt!, displayTimezone) + 15,
                item.endsAt ? minutesFromMidnight(item.endsAt, displayTimezone) : minutesFromMidnight(item.startsAt!, displayTimezone) + 60
              ),
            }));
            const { placement, totalCols } = layoutColumns(withMinutes.map((entry) => ({ id: entry.item.id, start: entry.start, end: entry.end })));
            const isToday = date === today;

            return (
              <div
                key={date}
                className="relative border-r border-line/70 last:border-r-0"
                onDragOver={acceptDrag}
                onDrop={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  const offsetMinutes = ((event.clientY - rect.top) / HOUR_HEIGHT) * 60 + dayStart * 60;
                  handleDrop(event, date, minutesToTime(snapMinutes(offsetMinutes)));
                }}
              >
                {hours.map((hour) => (
                  <div
                    key={hour}
                    style={{ height: HOUR_HEIGHT }}
                    className="group relative border-b border-line/40"
                  >
                    <button
                      type="button"
                      onClick={() => onCreate(date, `${String(hour).padStart(2, "0")}:00`)}
                      aria-label={`New event ${formatDayHeading(date)} at ${hour === 0 ? "12am" : hour <= 12 ? `${hour}am` : `${hour - 12}pm`}`}
                      className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-hover hover:bg-bg-2/40 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice group-hover:opacity-100"
                    >
                      <Plus className="size-3 text-text-lo/60" />
                    </button>
                  </div>
                ))}

                {isToday && nowMinutes != null && nowMinutes >= dayStart * 60 ? (
                  <div
                    className="flare-line pointer-events-none absolute left-0 right-0 z-10"
                    style={{ top: ((nowMinutes - dayStart * 60) / 60) * HOUR_HEIGHT }}
                  />
                ) : null}

                {withMinutes.map(({ item, start, end }) => {
                  const col = placement.get(item.id) ?? 0;
                  const width = 100 / totalCols;
                  const top = ((Math.max(start, dayStart * 60) - dayStart * 60) / 60) * HOUR_HEIGHT;
                  const height = Math.max(20, ((end - Math.max(start, dayStart * 60)) / 60) * HOUR_HEIGHT);
                  return (
                    <CalendarTimedItemSurface
                      key={item.id}
                      item={item}
                      displayTimezone={displayTimezone}
                      dense={height < 34}
                      onActivate={onActivate}
                      onDragStart={(dragged, event) => event.dataTransfer.setData("text/tempo-calendar", dragged.id)}
                      style={{
                        top,
                        height,
                        left: `calc(${col * width}% + 2px)`,
                        width: `calc(${width}% - 4px)`,
                      }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
    </div>
    </section>
  );
}
