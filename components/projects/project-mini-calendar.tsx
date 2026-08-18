"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type MiniCalendarItem = {
  key: string;
  date: string;
  label: string;
  /** Dot colour. Any CSS colour, usually a category colour or a token. */
  color: string;
  href?: string;
  done?: boolean;
};

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Month grid for a project: every date carrying a task or milestone gets a dot. */
export function ProjectMiniCalendar({
  items,
  today,
  className,
}: {
  items: MiniCalendarItem[];
  today: string;
  className?: string;
}) {
  const todayDate = React.useMemo(() => new Date(`${today}T12:00:00`), [today]);
  const [cursor, setCursor] = React.useState(() => new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));
  const [selected, setSelected] = React.useState<string | null>(null);

  const byDate = React.useMemo(() => {
    const map = new Map<string, MiniCalendarItem[]>();
    for (const item of items) {
      const list = map.get(item.date);
      if (list) list.push(item);
      else map.set(item.date, [item]);
    }
    return map;
  }, [items]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Monday-first offset.
  const lead = (first.getDay() + 6) % 7;

  const cells: ({ date: string; day: number } | null)[] = [];
  for (let i = 0; i < lead; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push({ date: ymd(year, month, d), day: d });
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedItems = selected ? (byDate.get(selected) ?? []) : [];

  return (
    <div className={cn("", className)}>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          className="rounded-input p-1 text-text-lo transition-colors duration-hover hover:bg-bg-2 hover:text-text-hi"
          onClick={() => setCursor(new Date(year, month - 1, 1))}
        >
          <ChevronLeft className="size-4" />
        </button>
        <p className="font-display text-sm font-semibold tracking-[0.02em] text-text-hi">
          {cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </p>
        <button
          type="button"
          aria-label="Next month"
          className="rounded-input p-1 text-text-lo transition-colors duration-hover hover:bg-bg-2 hover:text-text-hi"
          onClick={() => setCursor(new Date(year, month + 1, 1))}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((d, i) => (
          <span key={`${d}-${i}`} className="font-data text-[10px] uppercase tracking-[0.12em] text-text-lo/60">
            {d}
          </span>
        ))}
        {cells.map((cell, i) => {
          if (!cell) return <span key={`pad-${i}`} />;
          const dayItems = byDate.get(cell.date) ?? [];
          const isToday = cell.date === today;
          const isSelected = cell.date === selected;
          const overdue = dayItems.some((item) => !item.done && cell.date < today);
          return (
            <button
              key={cell.date}
              type="button"
              disabled={dayItems.length === 0}
              onClick={() => setSelected(isSelected ? null : cell.date)}
              className={cn(
                "relative flex h-8 flex-col items-center justify-center rounded-input font-data text-xs tabular-nums transition-colors duration-hover",
                dayItems.length > 0 ? "text-text-hi hover:bg-bg-2" : "text-text-lo/45",
                isToday && "ring-1 ring-inset ring-ice/60",
                isSelected && "bg-ice/15 text-ice",
                overdue && !isSelected && "text-warn"
              )}
            >
              <span className="leading-none">{cell.day}</span>
              {dayItems.length > 0 ? (
                <span className="mt-0.5 flex items-center gap-[2px]">
                  {dayItems.slice(0, 3).map((item) => (
                    <span
                      key={item.key}
                      className="size-1 rounded-full"
                      style={{ background: item.done ? "var(--ok)" : item.color }}
                    />
                  ))}
                </span>
              ) : (
                <span className="mt-0.5 h-1" />
              )}
            </button>
          );
        })}
      </div>

      {selected ? (
        <div className="rise-in mt-3 space-y-1.5 border-t border-line pt-3">
          <p className="label-mono">
            {new Date(`${selected}T12:00:00`).toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </p>
          {selectedItems.map((item) => {
            const body = (
              <span className="flex items-center gap-2">
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: item.done ? "var(--ok)" : item.color }}
                />
                <span className="truncate">{item.label}</span>
              </span>
            );
            return item.href ? (
              <Link
                key={item.key}
                href={item.href}
                className="block truncate text-xs text-text-hi transition-colors duration-hover hover:text-ice"
              >
                {body}
              </Link>
            ) : (
              <p key={item.key} className="truncate text-xs text-text-lo">
                {body}
              </p>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
