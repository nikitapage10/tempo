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
  date: string;
  categoryKey: string;
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

function dayValue(date: string): number {
  return new Date(`${date}T12:00:00`).getTime();
}

function toDate(value: number): Date {
  return new Date(value);
}

function shortDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type Lane = {
  key: string;
  label: string;
  color: string;
  startPct: number;
  endPct: number;
  tasks: ScheduleTask[];
  doneCount: number;
};

/**
 * Horizontal schedule for a project: one lane per task category, drawn as a
 * span from its first due date to its last, with a marker for every task and
 * a live "today" line. Milestones ride the axis above the lanes.
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
  const model = React.useMemo(() => {
    const dates = [...milestones.map((m) => m.date), ...tasks.map((t) => t.date), today];
    if (dates.length === 0) return null;
    const values = dates.map(dayValue);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (max - min < 7 * DAY_MS) {
      const mid = (min + max) / 2;
      min = mid - 3.5 * DAY_MS;
      max = mid + 3.5 * DAY_MS;
    }
    const pad = (max - min) * 0.06;
    min -= pad;
    max += pad;
    const span = max - min;
    const pct = (date: string) => ((dayValue(date) - min) / span) * 100;

    const byCategory = new Map<string, ScheduleTask[]>();
    for (const task of tasks) {
      const list = byCategory.get(task.categoryKey);
      if (list) list.push(task);
      else byCategory.set(task.categoryKey, [task]);
    }

    const lanes: Lane[] = Array.from(byCategory.entries())
      .map(([key, items]) => {
        const sorted = [...items].sort((a, b) => (a.date < b.date ? -1 : 1));
        return {
          key,
          label: sorted[0].categoryLabel,
          color: sorted[0].color,
          startPct: pct(sorted[0].date),
          endPct: pct(sorted[sorted.length - 1].date),
          tasks: sorted,
          doneCount: sorted.filter((t) => t.done).length,
        };
      })
      .sort((a, b) => a.startPct - b.startPct);

    // Month gridlines across the visible span.
    const ticks: { key: string; pct: number; label: string }[] = [];
    const cursor = toDate(min);
    cursor.setDate(1);
    cursor.setHours(12, 0, 0, 0);
    for (let i = 0; i < 36; i += 1) {
      const value = cursor.getTime();
      if (value > max) break;
      if (value >= min) {
        ticks.push({
          key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
          pct: ((value - min) / span) * 100,
          label: cursor.toLocaleDateString(undefined, { month: "short" }),
        });
      }
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return { pct, lanes, ticks, todayPct: pct(today) };
  }, [milestones, tasks, today]);

  if (!model || (model.lanes.length === 0 && milestones.length === 0)) return null;

  const { pct, lanes, ticks, todayPct } = model;

  return (
    <div className={cn("relative", className)}>
      <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3">
        {/* Axis */}
        <div />
        <div className="relative h-5">
          {ticks.map((tick) => (
            <span
              key={tick.key}
              className="absolute top-0 -translate-x-1/2 font-data text-[10px] uppercase tracking-[0.14em] text-text-lo/70"
              style={{ left: `${tick.pct}%` }}
            >
              {tick.label}
            </span>
          ))}
        </div>

        {/* Milestone rail */}
        <p className="label-mono self-center text-[10px]">Milestones</p>
        <div className="relative h-9">
          <Gridlines ticks={ticks} />
          <span aria-hidden className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-line" />
          {milestones.map((milestone, i) => (
            <span
              key={milestone.key}
              title={`${milestone.label} · ${shortDate(milestone.date)}`}
              className="diamond-pop absolute top-1/2 z-[2] size-2.5 rounded-[2px] border border-bg-0"
              style={{
                left: `${pct(milestone.date)}%`,
                transform: "translate(-50%, -50%) rotate(45deg)",
                background: TONE_HEX[milestone.tone],
                ["--rise-delay" as string]: `${120 + i * 45}ms`,
              }}
            />
          ))}
        </div>

        {/* Category lanes */}
        {lanes.map((lane, laneIndex) => (
          <React.Fragment key={lane.key}>
            <p className="self-center truncate text-right text-xs text-text-lo" title={lane.label}>
              {lane.label}
            </p>
            <div className="relative h-9">
              <Gridlines ticks={ticks} />
              <div
                className="bar-draw absolute top-1/2 h-5 -translate-y-1/2 rounded-chip border"
                style={{
                  left: `${lane.startPct}%`,
                  width: `${Math.max(lane.endPct - lane.startPct, 0.6)}%`,
                  background: `color-mix(in srgb, ${lane.color} 18%, transparent)`,
                  borderColor: `color-mix(in srgb, ${lane.color} 45%, transparent)`,
                  ["--rise-delay" as string]: `${200 + laneIndex * 70}ms`,
                }}
              />
              {lane.tasks.map((task, i) => (
                <span
                  key={task.id}
                  title={`${task.title} · ${shortDate(task.date)}`}
                  className={cn(
                    "dot-pop absolute top-1/2 z-[2] size-2.5 rounded-full border border-bg-0 transition-transform duration-hover hover:scale-150",
                    task.done && "opacity-70"
                  )}
                  style={{
                    left: `${pct(task.date)}%`,
                    transform: "translate(-50%, -50%)",
                    background: task.done ? "var(--ok)" : task.overdue ? "var(--warn)" : lane.color,
                    ["--rise-delay" as string]: `${260 + laneIndex * 70 + i * 30}ms`,
                  }}
                />
              ))}
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* Today marker spans the whole plot area. */}
      {todayPct >= 0 && todayPct <= 100 ? (
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 top-5 z-[1]"
          style={{ left: `calc(5.5rem + 0.75rem + (100% - 5.5rem - 0.75rem) * ${todayPct / 100})` }}
        >
          <span className="absolute inset-y-0 -left-px w-px bg-amber/50" />
          <span className="absolute -left-[3px] top-0 size-1.5 rounded-full bg-amber" />
        </div>
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
          className="absolute inset-y-0 w-px bg-line/50"
          style={{ left: `${tick.pct}%` }}
        />
      ))}
    </>
  );
}
