"use client";

import * as React from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { SectionHeader, QuietEmpty } from "@/components/ui/section-header";
import { SpectraCoverArt } from "@/components/spectra/spectra-cover-art";
import { formatShortDate } from "@/lib/format";
import {
  attentionGroups,
  nextMilestone,
  sortTrackHealthRows,
  type ChecklistRollup,
  type ProjectMilestone,
} from "@/lib/projects/health";
import type { Stage, Task, Track } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ProjectHealth({
  tasks,
  tracks,
  stages,
  rollupByTrack,
  milestones,
  today,
  onToggleTask,
}: {
  tasks: Task[];
  tracks: Track[];
  stages: Stage[];
  rollupByTrack: Map<string, ChecklistRollup>;
  milestones: ProjectMilestone[];
  today: string;
  onToggleTask: (task: Task) => void;
}) {
  const attention = React.useMemo(() => attentionGroups(tasks, today), [tasks, today]);
  const milestone = React.useMemo(() => nextMilestone(milestones, today), [milestones, today]);
  const trackRows = React.useMemo(
    () => sortTrackHealthRows(tracks, rollupByTrack, today),
    [tracks, rollupByTrack, today]
  );
  const stageName = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const stage of stages) map.set(stage.id, stage.name);
    return map;
  }, [stages]);

  const attentionEmpty =
    attention.overdue.length === 0 &&
    attention.thisWeek.length === 0 &&
    attention.needsDate.length === 0 &&
    !milestone;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="panel-quiet rise-in p-5" style={{ ["--rise-delay" as string]: "60ms" }}>
        <SectionHeader label="Attention" />
        {attentionEmpty ? (
          <QuietEmpty>Nothing urgent on this project.</QuietEmpty>
        ) : (
          <div className="space-y-4">
            <AttentionGroup
              label="Overdue"
              tone="text-warn"
              tasks={attention.overdue}
              today={today}
              onToggle={onToggleTask}
            />
            <AttentionGroup
              label="This week"
              tone="text-text-lo"
              tasks={attention.thisWeek}
              today={today}
              onToggle={onToggleTask}
            />
            <AttentionGroup
              label="Needs a date"
              tone="text-text-lo"
              tasks={attention.needsDate}
              today={today}
              onToggle={onToggleTask}
            />
            {milestone ? (
              <div>
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="label-mono text-[10px] text-amber">Next milestone</span>
                </div>
                <div className="well flex items-center justify-between gap-3 px-2.5 py-2">
                  <span className="min-w-0 truncate text-sm text-text-hi">{milestone.label}</span>
                  <span className="shrink-0 font-data text-xs tabular-nums text-text-lo">
                    {formatShortDate(milestone.date)}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section className="panel-quiet rise-in p-5" style={{ ["--rise-delay" as string]: "90ms" }}>
        <SectionHeader label="Tracks on this project" count={tracks.length} />
        {trackRows.length === 0 ? (
          <QuietEmpty>Attach a track to see how the songs are moving.</QuietEmpty>
        ) : (
          <ul className="space-y-1.5">
            {trackRows.map(({ track, checklistPct, overdue }) => (
              <li
                key={track.id}
                className="well flex items-center gap-3 px-2.5 py-2 transition-colors duration-hover hover:border-ice/30"
              >
                <div className="relative size-8 shrink-0 overflow-hidden rounded-input border border-line">
                  <SpectraCoverArt
                    trackId={track.id}
                    title={track.title}
                    artworkUrl={track.artwork_url}
                    animate={false}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/track/${track.id}`}
                    className="block truncate text-sm text-text-hi hover:text-ice"
                  >
                    {track.title}
                  </Link>
                  <p className="mt-0.5 truncate font-data text-[11px] text-text-lo">
                    {track.stage_id ? stageName.get(track.stage_id) ?? "Unstaged" : "Unstaged"}
                    {checklistPct != null ? ` · ${checklistPct}% checklist` : null}
                    {track.next_action ? (
                      <span className={overdue ? " text-warn" : undefined}>
                        {" · "}
                        {track.next_action}
                        {track.next_action_due ? ` · ${formatShortDate(track.next_action_due)}` : null}
                      </span>
                    ) : track.next_action_due ? (
                      <span className={overdue ? " text-warn" : undefined}>
                        {" · "}
                        {formatShortDate(track.next_action_due)}
                      </span>
                    ) : null}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AttentionGroup({
  label,
  tone,
  tasks,
  today,
  onToggle,
}: {
  label: string;
  tone: string;
  tasks: Task[];
  today: string;
  onToggle: (task: Task) => void;
}) {
  if (tasks.length === 0) return null;
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <span className={cn("label-mono text-[10px]", tone)}>{label}</span>
        <span className="font-data text-[10px] tabular-nums text-text-lo/60">{tasks.length}</span>
      </div>
      <ul className="space-y-1">
        {tasks.map((task) => {
          const overdue = Boolean(task.due_date && task.due_date < today);
          return (
            <li
              key={task.id}
              className="well flex items-center gap-2.5 px-2.5 py-2 transition-colors duration-hover hover:border-ice/30"
            >
              <button
                type="button"
                aria-label={`Complete ${task.title}`}
                onClick={() => onToggle(task)}
                className="flex size-4 shrink-0 items-center justify-center rounded-full border border-line text-transparent transition-colors duration-hover hover:border-ice hover:text-ice"
              >
                <Check className="size-2.5" />
              </button>
              <Link
                href={`/tasks?edit=${task.id}`}
                className={cn(
                  "min-w-0 flex-1 truncate text-sm hover:text-ice",
                  overdue ? "text-warn" : "text-text-hi"
                )}
              >
                {task.title}
              </Link>
              {task.due_date ? (
                <span
                  className={cn(
                    "shrink-0 font-data text-[11px] tabular-nums",
                    overdue ? "text-warn" : "text-text-lo"
                  )}
                >
                  {formatShortDate(task.due_date)}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
