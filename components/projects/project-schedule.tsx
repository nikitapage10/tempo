"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type ScheduleMilestone = {
  key: string;
  date: string;
  label: string;
  tone: "ice" | "amber" | "ok" | "warn";
};

export type ScheduleTask = {
  id: string;
  title: string;
  /** When the task appeared. The left end of its bar. */
  startDate: string;
  /** Due date. The right end of its bar. */
  date: string;
  categoryLabel: string;
  color: string;
  done: boolean;
  overdue: boolean;
};

const TONE_HEX: Record<ScheduleMilestone["tone"], string> = {
  ice: "var(--ice)",
  amber: "var(--amber)",
  ok: "var(--ok)",
  warn: "var(--warn)",
};

const DAY_MS = 86_400_000;
const LABEL_COL = "9.5rem";
const GAP = "0.75rem";
const COLLAPSED_ROWS = 8;

function dayValue(date: string): number {
  return new Date(`${date}T12:00:00`).getTime();
}

function shortDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/**
 * Gantt for a project. One row per dated task, its bar running from the day the
 * task appeared to the day it is due, so the length is the time there actually
 * is — never an invented span. An overdue bar keeps running past today in warn.
 * Milestones ride a rail above the rows, and a live line marks today.
 */
export function ProjectSchedule({
  milestones,
  tasks,
  today,
  className,
}: {
  milestones: ScheduleMilestone[];
  tasks: ScheduleTask[];
  today: string;
  className?: string;
}) {
  const [expanded, setExpanded] = React.useState(false);

  const model = React.useMemo(() => {
    const rows = [...tasks].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return a.title.localeCompare(b.title);
    });

    const dates = [
      ...milestones.map((m) => m.date),
      ...rows.map((t) => t.date),
      ...rows.map((t) => t.startDate),
      today,
    ];
    if (dates.length === 0) return null;

    const values = dates.map(dayValue);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (max - min < 7 * DAY_MS) {
      const mid = (min + max) / 2;
      min = mid - 3.5 * DAY_MS;
      max = mid + 3.5 * DAY_MS;
    }
    const pad = (max - min) * 0.04;
    min -= pad;
    max += pad;
    const span = max - min;
    const pct = (date: string) => ((dayValue(date) - min) / span) * 100;

    // Week gridlines, labelled where the month turns over.
    const ticks: { key: string; pct: number; label: string | null }[] = [];
    const cursor = new Date(min);
    cursor.setHours(12, 0, 0, 0);
    cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7)); // back to Monday
    let lastMonth = -1;
    for (let i = 0; i < 80; i += 1) {
      const value = cursor.getTime();
      if (value > max) break;
      if (value >= min) {
        const month = cursor.getMonth();
        ticks.push({
          key: `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`,
          pct: ((value - min) / span) * 100,
          label:
            month !== lastMonth
              ? cursor.toLocaleDateString(undefined, { month: "short" })
              : null,
        });
        lastMonth = month;
      }
      cursor.setDate(cursor.getDate() + 7);
    }

    return { rows, pct, ticks, todayPct: pct(today) };
  }, [milestones, tasks, today]);

  if (!model) return null;

  const { rows, pct, ticks, todayPct } = model;
  const visible = expanded ? rows : rows.slice(0, COLLAPSED_ROWS);
  const hidden = rows.length - visible.length;

  return (
    <div className={cn("relative", className)}>
      <div
        className="grid gap-x-3"
        style={{ gridTemplateColumns: `${LABEL_COL} minmax(0, 1fr)` }}
      >
        {/* Axis */}
        <div />
        <div className="relative h-5">
          {ticks.map((tick) =>
            tick.label ? (
              <span
                key={tick.key}
                className="absolute top-0 -translate-x-1/2 text-[10px] uppercase tracking-[0.14em] text-text-lo/70"
                style={{ left: `${tick.pct}%` }}
              >
                {tick.label}
              </span>
            ) : null,
          )}
        </div>

        {/* Milestone rail */}
        {milestones.length > 0 ? (
          <>
            <p className="label-mono self-center text-[10px]">Milestones</p>
            <div className="relative h-8">
              <Gridlines ticks={ticks} />
              <span
                aria-hidden
                className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-line"
              />
              {milestones.map((milestone, i) => (
                <span
                  key={milestone.key}
                  title={`${milestone.label} · ${shortDate(milestone.date)}`}
                  className="diamond-pop absolute top-1/2 z-[2] size-2.5 rounded-[2px] border border-bg-0"
                  style={{
                    left: `${pct(milestone.date)}%`,
                    background: TONE_HEX[milestone.tone],
                    ["--rise-delay" as string]: `${120 + i * 45}ms`,
                  }}
                />
              ))}
            </div>
          </>
        ) : null}

        {/* One row per task */}
        {visible.map((task, i) => {
          const start = Math.min(pct(task.startDate), pct(task.date));
          // An overdue task keeps running to today: that overrun is the point.
          const endDate = task.overdue ? today : task.date;
          const end = Math.max(pct(endDate), start);
          const tone = task.done ? "var(--ok)" : task.overdue ? "var(--warn)" : task.color;
          return (
            <React.Fragment key={task.id}>
              <p
                className={cn(
                  "self-center truncate text-right text-xs",
                  task.done ? "text-text-lo line-through" : "text-text-hi",
                )}
                title={`${task.title} · ${task.categoryLabel}`}
              >
                {task.title}
              </p>
              <div className="relative h-8">
                <Gridlines ticks={ticks} />
                <div
                  className="bar-draw absolute top-1/2 h-4 -translate-y-1/2 rounded-chip border"
                  title={`${task.categoryLabel} · due ${shortDate(task.date)}`}
                  style={{
                    left: `${start}%`,
                    width: `${Math.max(end - start, 0.8)}%`,
                    background: `color-mix(in srgb, ${tone} ${task.done ? 12 : 22}%, transparent)`,
                    borderColor: `color-mix(in srgb, ${tone} ${task.done ? 30 : 55}%, transparent)`,
                    ["--rise-delay" as string]: `${180 + i * 55}ms`,
                  }}
                />
                {/* Due-date cap, so the deadline stays readable on a short bar. */}
                <span
                  aria-hidden
                  className="dot-pop absolute top-1/2 z-[2] size-2 rounded-full border border-bg-0"
                  style={{
                    left: `${pct(task.date)}%`,
                    background: tone,
                    ["--rise-delay" as string]: `${240 + i * 55}ms`,
                  }}
                />
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Today marker spans the plot area. */}
      {todayPct >= 0 && todayPct <= 100 ? (
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 top-5 z-[1]"
          style={{
            left: `calc(${LABEL_COL} + ${GAP} + (100% - ${LABEL_COL} - ${GAP}) * ${todayPct / 100})`,
          }}
        >
          <span className="absolute inset-y-0 -left-px w-px bg-amber/45" />
          <span className="absolute -left-[3px] top-0 size-1.5 rounded-full bg-amber" />
        </div>
      ) : null}

      {hidden > 0 || expanded ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-xs text-ice hover:underline"
          style={{ marginLeft: `calc(${LABEL_COL} + ${GAP})` }}
        >
          {expanded ? "Show less" : `Show ${hidden} more`}
        </button>
      ) : null}
    </div>
  );
}

function Gridlines({ ticks }: { ticks: { key: string; pct: number }[] }) {
  return (
    <>
      {ticks.map((tick) => (
        <span
          key={tick.key}
          aria-hidden
          className="absolute inset-y-0 w-px bg-line/40"
          style={{ left: `${tick.pct}%` }}
        />
      ))}
    </>
  );
}
