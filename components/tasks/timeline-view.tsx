"use client";

import * as React from "react";
import { useTaskCategoryPalette } from "@/components/tasks/task-category-provider";
import { taskCategoryChipStyle } from "@/lib/tasks/categories";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_DOT: Record<string, string> = {
  overdue: "bg-warn",
  today: "bg-amber",
  future: "bg-ice",
  none: "bg-text-lo/40",
};

/**
 * A chronological rail of open tasks — the third view alongside Lanes and
 * List. Overdue tasks collapse into one warn-tinted node at the top so a
 * backlog doesn't dominate the timeline; everything else is grouped by due
 * date, with undated tasks parked at the bottom.
 */
export function TimelineView({
  tasks,
  today,
  projectName,
  assigneeLabel,
  onOpen,
}: {
  tasks: Task[];
  today: string;
  projectName: (id: string | null) => string | undefined;
  assigneeLabel: (id: string | null | undefined) => string | undefined;
  onOpen: (task: Task) => void;
}) {
  const { categories } = useTaskCategoryPalette();

  const { overdue, byDate, undated } = React.useMemo(() => {
    const overdue: Task[] = [];
    const undated: Task[] = [];
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.due_date) {
        undated.push(task);
        continue;
      }
      if (task.due_date < today) {
        overdue.push(task);
        continue;
      }
      const list = map.get(task.due_date) ?? [];
      list.push(task);
      map.set(task.due_date, list);
    }
    const byDate = Array.from(map.entries()).sort(([a], [b]) => (a < b ? -1 : 1));
    return { overdue, byDate, undated };
  }, [tasks, today]);

  const nodes: Array<{ key: string; label: string; status: keyof typeof STATUS_DOT; items: Task[] }> = [];
  if (overdue.length) nodes.push({ key: "overdue", label: "Overdue", status: "overdue", items: overdue });
  for (const [date, items] of byDate) {
    nodes.push({
      key: date,
      label: new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      status: date === today ? "today" : "future",
      items,
    });
  }
  if (undated.length) nodes.push({ key: "undated", label: "No date", status: "none", items: undated });

  if (!nodes.length) {
    return <p className="well px-4 py-8 text-center text-sm text-text-lo">Nothing to show on the timeline.</p>;
  }

  return (
    <div className="panel-quiet p-5">
      <ol className="relative space-y-6 pl-6">
        <span aria-hidden className="absolute bottom-2 left-[7px] top-2 w-px bg-line" />
        {nodes.map((node) => (
          <li key={node.key} className="relative">
            <span
              aria-hidden
              className={cn("absolute -left-6 top-1 size-3.5 rounded-full border-2 border-bg-0", STATUS_DOT[node.status])}
            />
            <div className="mb-2 flex items-center gap-2">
              <h3 className={cn("font-display text-sm font-semibold", node.status === "overdue" ? "text-warn" : "text-text-hi")}>
                {node.label}
              </h3>
              <span className="font-data text-xs tabular-nums text-text-lo">{node.items.length}</span>
              {node.status === "today" ? <span className="flare-line !w-10" /> : null}
            </div>
            <ul className="space-y-1.5">
              {node.items.map((task) => {
                const category = categories.find((c) => c.key === task.category);
                return (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(task)}
                      className="well flex w-full items-center gap-2 px-3 py-2 text-left transition-colors duration-hover hover:bg-bg-2/80"
                    >
                      <span
                        className={cn("shrink-0 text-sm", task.status === "done" ? "text-text-lo line-through" : "text-text-hi")}
                      >
                        {task.title}
                      </span>
                      <span
                        className="ml-auto shrink-0 rounded-chip border border-line bg-bg-2 px-2 py-0.5 text-[11px] text-text-lo"
                        style={taskCategoryChipStyle(category)}
                      >
                        {category?.label ?? task.category}
                      </span>
                      {task.project_id ? (
                        <span className="shrink-0 rounded-chip bg-amber/10 px-2 py-0.5 text-[11px] text-amber">
                          {projectName(task.project_id)}
                        </span>
                      ) : null}
                      {assigneeLabel(task.assigned_to_user_id) ? (
                        <span className="shrink-0 text-[11px] text-text-lo">→ {assigneeLabel(task.assigned_to_user_id)}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
