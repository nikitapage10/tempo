"use client";

import { useDraggable } from "@dnd-kit/core";
import { motion } from "framer-motion";
import * as React from "react";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { useLayoutMove } from "@/components/ui/layout-item";
import { useTaskCategoryPalette } from "@/components/tasks/task-category-provider";
import { taskDragId } from "@/lib/tasks/buckets";
import { taskCategoryChipStyle, taskCategorySurfaceStyle } from "@/lib/tasks/categories";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

const PRIORITY_STRIPE: Record<number, string> = {
  1: "before:bg-ice",
  2: "before:bg-amber",
  3: "before:bg-warn",
};

type TaskRowProps = {
  task: Task;
  trackTitle?: string;
  projectTitle?: string;
  assigneeLabel?: string;
  stepProgress?: { done: number; total: number };
  overdue: boolean;
  focused?: boolean;
  onToggle: () => Promise<void>;
  onDelete: () => Promise<void>;
  onOpen: () => void;
};

export function DraggableTaskRow(props: TaskRowProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: taskDragId(props.task.id),
    data: { kind: "task" as const, task: props.task },
  });

  return (
    <TaskRow
      {...props}
      layoutId={`task-${props.task.id}`}
      rowRef={setNodeRef}
      dragProps={{ ...listeners, ...attributes }}
      className={cn(isDragging && "opacity-40")}
    />
  );
}

export function TaskRow({
  task,
  trackTitle,
  projectTitle,
  assigneeLabel,
  stepProgress,
  overdue,
  focused,
  onToggle,
  onDelete,
  onOpen,
  rowRef,
  dragProps,
  className,
  layoutId,
}: TaskRowProps & {
  rowRef?: React.Ref<HTMLDivElement>;
  dragProps?: React.HTMLAttributes<HTMLDivElement>;
  className?: string;
  layoutId?: string;
}) {
  const [confirm, setConfirm] = React.useState(false);
  const { categories } = useTaskCategoryPalette();
  const category = categories.find((item) => item.key === task.category);
  const cat = category?.label ?? task.category;
  const layoutMove = useLayoutMove(layoutId ?? `task-${task.id}`, Boolean(layoutId));

  return (
    <li
      id={`task-${task.id}`}
      className={cn("list-none", className)}
    >
      <div
        ref={rowRef}
        {...dragProps}
        className={cn(
          dragProps && "cursor-grab touch-none active:cursor-grabbing"
        )}
      >
        <motion.div {...layoutMove}>
        <SpotlightCard
          role="button"
          tabIndex={0}
          onClick={onOpen}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpen();
            }
          }}
          tone={overdue ? "warn" : task.status === "done" ? "ok" : "ice"}
          accent={!overdue && task.status !== "done" ? category?.color : undefined}
          radius={10}
          size={180}
          style={!overdue && task.status !== "done" ? taskCategorySurfaceStyle(category) : undefined}
          className={cn(
            "relative flex cursor-pointer items-start gap-3 rounded-card border border-line bg-bg-1 py-2.5 pl-4 pr-3",
            "before:absolute before:inset-y-1.5 before:left-1.5 before:w-1 before:rounded-full before:bg-transparent",
            PRIORITY_STRIPE[task.priority],
            focused && "ring-2 ring-ice shadow-e2"
          )}
        >
        <input
          type="checkbox"
          checked={task.status === "done"}
          onChange={() => void onToggle()}
          onClick={(e) => e.stopPropagation()}
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
            {task.due_date ? (
              <span className={cn("rounded-chip border border-line bg-bg-2 px-2 py-0.5 font-data text-[11px]", overdue ? "text-warn" : "text-text-lo")}>
                {new Date(`${task.due_date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            ) : null}
            {task.track_id && trackTitle ? (
              <span className="rounded-chip bg-ice/10 px-2 py-0.5 text-xs text-ice">{trackTitle}</span>
            ) : null}
            {task.project_id && projectTitle ? (
              <span className="rounded-chip bg-amber/10 px-2 py-0.5 text-xs text-amber">{projectTitle}</span>
            ) : null}
            {assigneeLabel ? (
              <span className="rounded-chip border border-line bg-bg-2 px-2 py-0.5 text-xs text-text-lo">→ {assigneeLabel}</span>
            ) : null}
            {stepProgress && stepProgress.total > 0 ? (
              <span className="rounded-chip border border-line bg-bg-2 px-2 py-0.5 font-data text-[11px] text-text-lo">
                {stepProgress.done}/{stepProgress.total}
              </span>
            ) : null}
          </div>
        </div>
        {confirm ? (
          <span
            className="flex shrink-0 items-center gap-1 text-xs"
            onClick={(e) => e.stopPropagation()}
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
            onClick={(e) => {
              e.stopPropagation();
              setConfirm(true);
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            Delete
          </button>
        )}
        </SpotlightCard>
        </motion.div>
      </div>
    </li>
  );
}
