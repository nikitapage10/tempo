"use client";

import { useDraggable } from "@dnd-kit/core";
import Link from "next/link";
import * as React from "react";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { useTaskCategoryPalette } from "@/components/tasks/task-category-provider";
import { TASK_STATUSES } from "@/lib/constants";
import { taskDragId } from "@/lib/tasks/buckets";
import { taskCategoryChipStyle, taskCategorySurfaceStyle } from "@/lib/tasks/categories";
import type { Task, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type TaskRowProps = {
  task: Task;
  trackTitle?: string;
  projectTitle?: string;
  overdue: boolean;
  focused?: boolean;
  onToggle: () => Promise<void>;
  onStatus: (s: TaskStatus) => Promise<void>;
  onDue: (date: string) => Promise<void>;
  onDelete: () => Promise<void>;
  assignees?: { userId: string; label: string }[];
  onAssign?: (userId: string | null) => Promise<void>;
};

export function DraggableTaskRow(props: TaskRowProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: taskDragId(props.task.id),
    data: { kind: "task" as const, task: props.task },
  });

  return (
    <TaskRow
      {...props}
      rowRef={setNodeRef}
      rowProps={{ ...listeners, ...attributes }}
      className={cn("cursor-grab", isDragging && "opacity-40")}
    />
  );
}

export function TaskRow({
  task,
  trackTitle,
  projectTitle,
  overdue,
  focused,
  onToggle,
  onStatus,
  onDue,
  onDelete,
  assignees = [],
  onAssign,
  rowRef,
  rowProps,
  className,
}: TaskRowProps & {
  rowRef?: React.Ref<HTMLLIElement>;
  rowProps?: React.HTMLAttributes<HTMLLIElement>;
  className?: string;
}) {
  const [confirm, setConfirm] = React.useState(false);
  const { categories } = useTaskCategoryPalette();
  const category = categories.find((item) => item.key === task.category);
  const cat = category?.label ?? task.category;

  return (
    <li
      ref={rowRef}
      id={`task-${task.id}`}
      className={cn("list-none", className)}
      {...rowProps}
    >
      <SpotlightCard
        tone={overdue ? "warn" : task.status === "done" ? "ok" : "ice"}
        accent={!overdue && task.status !== "done" ? category?.color : undefined}
        radius={10}
        size={180}
        style={!overdue && task.status !== "done" ? taskCategorySurfaceStyle(category) : undefined}
        className={cn(
          "flex items-start gap-3 rounded-card border border-line bg-bg-1 px-3 py-2.5",
          focused && "ring-2 ring-ice shadow-e2"
        )}
      >
        <input
          type="checkbox"
          checked={task.status === "done"}
          onChange={() => void onToggle()}
          onPointerDown={(e) => e.stopPropagation()}
          className="mt-1 size-4 accent-[var(--ice)]"
          aria-label={`Mark ${task.title} done`}
        />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-sm",
              task.status === "done"
                ? "text-text-lo line-through"
                : overdue
                  ? "text-warn"
                  : "text-text-hi"
            )}
          >
            {task.title}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span
              className="rounded-chip border border-line bg-bg-2 px-2 py-0.5 text-xs text-text-lo"
              style={taskCategoryChipStyle(category)}
            >
              {cat}
            </span>
            <select
              className="h-6 rounded-chip border border-line bg-bg-2 px-2 font-mono text-[11px] text-text-lo"
              value={task.status}
              onChange={(e) => void onStatus(e.target.value as TaskStatus)}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            {task.due_date ? (
              <input
                type="date"
                value={task.due_date}
                onChange={(e) => void onDue(e.target.value)}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label={`Due date for ${task.title}`}
                className={cn(
                  "h-6 rounded-chip border border-line bg-bg-2 px-2 font-mono text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice",
                  overdue ? "text-warn" : "text-text-lo"
                )}
              />
            ) : null}
            {task.track_id && trackTitle ? (
              <Link
                href={`/track/${task.track_id}`}
                onPointerDown={(e) => e.stopPropagation()}
                className="rounded-chip bg-ice/10 px-2 py-0.5 text-xs text-ice hover:underline"
              >
                {trackTitle}
              </Link>
            ) : null}
            {task.project_id && projectTitle ? (
              <Link
                href={`/projects/${task.project_id}`}
                onPointerDown={(e) => e.stopPropagation()}
                className="rounded-chip bg-amber/10 px-2 py-0.5 text-xs text-amber hover:underline"
              >
                {projectTitle}
              </Link>
            ) : null}
            {onAssign ? (
              <select
                aria-label={`Assignee for ${task.title}`}
                value={task.assigned_to_user_id ?? ""}
                onChange={(e) => void onAssign(e.target.value || null)}
                onPointerDown={(e) => e.stopPropagation()}
                className="h-6 max-w-40 rounded-chip border border-line bg-bg-2 px-2 font-mono text-[11px] text-text-lo"
              >
                <option value="">Unassigned</option>
                {assignees.map((person) => <option key={person.userId} value={person.userId}>{person.label}</option>)}
              </select>
            ) : null}
          </div>
          {task.notes ? (
            <p className="mt-1 text-xs text-text-lo">{task.notes}</p>
          ) : null}
        </div>
        {confirm ? (
          <span
            className="flex shrink-0 items-center gap-1 text-xs"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="text-warn hover:underline"
              onClick={() => void onDelete()}
            >
              Delete
            </button>
            <button
              type="button"
              className="text-text-lo"
              onClick={() => setConfirm(false)}
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="shrink-0 text-xs text-text-lo hover:text-warn"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setConfirm(true)}
          >
            Delete
          </button>
        )}
      </SpotlightCard>
    </li>
  );
}
