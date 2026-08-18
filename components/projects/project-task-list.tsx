"use client";

import * as React from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { formatShortDate } from "@/lib/format";
import { taskCategoryChipStyle } from "@/lib/tasks/categories";
import type { TaskCategoryDefinition } from "@/lib/tasks/categories";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

type Group = { key: string; label: string; tone: string; tasks: Task[] };

function groupTasks(tasks: Task[], today: string): Group[] {
  const open = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");
  const overdue = open.filter((t) => t.due_date && t.due_date < today);
  const dated = open
    .filter((t) => t.due_date && t.due_date >= today)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));
  const undated = open.filter((t) => !t.due_date);

  return [
    { key: "overdue", label: "Overdue", tone: "text-warn", tasks: overdue },
    { key: "scheduled", label: "Scheduled", tone: "text-text-lo", tasks: dated },
    { key: "unscheduled", label: "No date", tone: "text-text-lo", tasks: undated },
    { key: "done", label: "Done", tone: "text-ok", tasks: done },
  ].filter((g) => g.tasks.length > 0);
}

/** Project task list, grouped by urgency, with inline completion. */
export function ProjectTaskList({
  tasks,
  categories,
  today,
  onToggle,
  onDetach,
}: {
  tasks: Task[];
  categories: TaskCategoryDefinition[];
  today: string;
  onToggle: (task: Task) => void;
  onDetach: (task: Task) => void;
}) {
  const groups = React.useMemo(() => groupTasks(tasks, today), [tasks, today]);
  let index = 0;

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.key}>
          <div className="mb-1.5 flex items-center gap-2">
            <span className={cn("label-mono text-[10px]", group.tone)}>{group.label}</span>
            <span className="font-data text-[10px] tabular-nums text-text-lo/60">{group.tasks.length}</span>
          </div>
          <ul className="space-y-1">
            {group.tasks.map((task) => {
              const category = categories.find((item) => item.key === task.category);
              const done = task.status === "done";
              const overdue = !done && Boolean(task.due_date && task.due_date < today);
              const delay = `${Math.min(index++, 12) * 28}ms`;
              return (
                <li
                  key={task.id}
                  className="rise-in group flex items-center gap-3 rounded-input border border-line bg-bg-2/40 px-2.5 py-2 transition-colors duration-hover hover:border-ice/30 hover:bg-bg-2/70"
                  style={{ ["--rise-delay" as string]: delay }}
                >
                  <span
                    aria-hidden
                    className="h-6 w-[3px] shrink-0 rounded-full"
                    style={{ background: done ? "var(--ok)" : (category?.color ?? "var(--line)") }}
                  />
                  <button
                    type="button"
                    aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
                    onClick={() => onToggle(task)}
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-hover",
                      done ? "border-ok bg-ok/20 text-ok" : "border-line text-transparent hover:border-ice hover:text-ice"
                    )}
                  >
                    <Check className="size-2.5" strokeWidth={3} />
                  </button>
                  <Link
                    href={`/tasks?edit=${task.id}`}
                    className={cn(
                      "min-w-0 flex-1 truncate text-sm transition-colors duration-hover hover:text-ice",
                      done ? "text-text-lo line-through" : "text-text-hi"
                    )}
                  >
                    {task.title}
                  </Link>
                  {task.due_date ? (
                    <span
                      className={cn(
                        "hidden font-data text-[11px] tabular-nums sm:inline",
                        overdue ? "text-warn" : "text-text-lo"
                      )}
                    >
                      {formatShortDate(`${task.due_date}T12:00:00`)}
                    </span>
                  ) : null}
                  <span
                    className="hidden rounded-chip border border-line px-2 py-0.5 text-[11px] text-text-lo md:inline"
                    style={taskCategoryChipStyle(category)}
                  >
                    {category?.label ?? task.category}
                  </span>
                  <button
                    type="button"
                    className="text-xs text-text-lo opacity-0 transition-opacity duration-hover hover:text-warn focus-visible:opacity-100 group-hover:opacity-100"
                    onClick={() => onDetach(task)}
                  >
                    Detach
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
