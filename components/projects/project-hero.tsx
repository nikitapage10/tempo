"use client";

import * as React from "react";
import { Chip } from "@/components/ui/chip";
import { ProgressRing } from "@/components/projects/progress-ring";
import { FlareLine } from "@/components/flare-line";
import { PROJECT_TYPES } from "@/lib/constants";
import { localDateString } from "@/lib/format";
import type { Project, ProjectStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<ProjectStatus, string> = { active: "Active", done: "Done", parked: "Parked" };
const STATUS_TONE: Record<ProjectStatus, string> = {
  active: "border-ice/40 bg-ice/10 text-ice",
  done: "border-ok/40 bg-ok/10 text-ok",
  parked: "border-line bg-bg-2 text-text-lo",
};

function daysLabel(deadline: string | null, today: string): string | null {
  if (!deadline) return null;
  const diff = Math.round((new Date(`${deadline}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86_400_000);
  if (diff < 0) return `${Math.abs(diff)} day${Math.abs(diff) === 1 ? "" : "s"} late`;
  if (diff === 0) return "Due today";
  return `${diff} day${diff === 1 ? "" : "s"} out`;
}

export function ProjectHero({
  project,
  trackCount,
  tasksOpen,
  tasksDone,
  progressPct,
  nextUp,
  onStatusChange,
  onEditDetails,
}: {
  project: Project;
  trackCount: number;
  tasksOpen: number;
  tasksDone: number;
  progressPct: number | null;
  nextUp?: { label: string; date: string } | null;
  onStatusChange: (status: ProjectStatus) => void;
  onEditDetails: () => void;
}) {
  const today = localDateString();
  const days = daysLabel(project.deadline, today);
  const late = Boolean(project.deadline && project.deadline < today);
  const type = PROJECT_TYPES.find((t) => t.value === project.project_type)?.label;

  return (
    <div className="glass-hero prism-edge relative overflow-hidden px-6 py-7 sm:px-8 sm:py-9">
      <div className="relative z-[1]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <Chip size="sm" active className={STATUS_TONE[project.status]}>
                {STATUS_LABELS[project.status]}
              </Chip>
              {type && project.project_type !== "general" ? <Chip size="sm">{type}</Chip> : null}
              {days ? (
                <Chip size="sm" className={late ? "border-warn/40 bg-warn/10 text-warn" : undefined}>
                  {days}
                </Chip>
              ) : null}
            </div>
            <h1 className="truncate font-display text-3xl font-semibold tracking-[0.02em] text-text-hi sm:text-[40px] sm:leading-[1.05]">
              {project.name}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {(["active", "done", "parked"] as ProjectStatus[]).map((s) => (
              <Chip key={s} size="sm" active={project.status === s} onClick={() => onStatusChange(s)}>
                {STATUS_LABELS[s]}
              </Chip>
            ))}
            <button type="button" onClick={onEditDetails} className="ml-1 text-xs text-ice hover:underline">
              Edit details
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-[14rem] flex-1">
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <Stat label="Tracks" value={trackCount} />
              <Stat label="Tasks open" value={tasksOpen} />
              <Stat label="Tasks done" value={tasksDone} />
            </div>
            <div className="mt-4 max-w-md">
              {progressPct != null ? (
                <FlareLine variant="partial" pct={progressPct} />
              ) : (
                <FlareLine className="opacity-60" />
              )}
              {nextUp ? (
                <p className="mt-2 text-xs text-text-lo">
                  Next up <span className="text-text-hi">{nextUp.label}</span>{" "}
                  <span className="font-data tabular-nums">
                    {new Date(`${nextUp.date}T12:00:00`).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </p>
              ) : null}
            </div>
          </div>

          {progressPct != null ? <ProgressRing pct={progressPct} className="hidden sm:block" /> : null}
        </div>

      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="label-mono">{label}</p>
      <p className="stat-value">{value}</p>
    </div>
  );
}
