"use client";

import * as React from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { useTaskCategoryPalette } from "@/components/tasks/task-category-provider";
import { taskCategoryChipStyle } from "@/lib/tasks/categories";
import type { Task, TaskPriority } from "@/lib/types";
import { cn } from "@/lib/utils";

type SortKey = "title" | "category" | "priority" | "due_date" | "assignee" | "project";
type GroupBy = "none" | "project" | "category" | "assignee";

const PRIORITY_LABELS: Record<TaskPriority, string> = { 0: "—", 1: "Low", 2: "High", 3: "Urgent" };
const PRIORITY_TONE: Record<TaskPriority, string> = {
  0: "text-text-lo",
  1: "text-ice",
  2: "text-amber",
  3: "text-warn",
};

export function ListView({
  tasks,
  trackName,
  projectName,
  assigneeLabel,
  selected,
  onToggleSelect,
  onOpen,
  onToggleDone,
}: {
  tasks: Task[];
  trackName: (id: string | null) => string | undefined;
  projectName: (id: string | null) => string | undefined;
  assigneeLabel: (id: string | null | undefined) => string | undefined;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onOpen: (task: Task) => void;
  onToggleDone: (task: Task) => Promise<void>;
}) {
  const { categories } = useTaskCategoryPalette();
  const [sortKey, setSortKey] = React.useState<SortKey>("due_date");
  const [sortDir, setSortDir] = React.useState<1 | -1>(1);
  const [groupBy, setGroupBy] = React.useState<GroupBy>("none");

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  const sortValue = React.useCallback(
    (task: Task): string | number => {
      switch (sortKey) {
        case "title":
          return task.title.toLowerCase();
        case "category":
          return task.category;
        case "priority":
          return task.priority;
        case "due_date":
          return task.due_date ?? "9999-99-99";
        case "assignee":
          return assigneeLabel(task.assigned_to_user_id) ?? "";
        case "project":
          return projectName(task.project_id) ?? "";
      }
    },
    [sortKey, assigneeLabel, projectName]
  );

  const sorted = React.useMemo(() => {
    return [...tasks].sort((a, b) => {
      const av = sortValue(a);
      const bv = sortValue(b);
      if (av < bv) return -1 * sortDir;
      if (av > bv) return 1 * sortDir;
      return 0;
    });
  }, [tasks, sortValue, sortDir]);

  const groups = React.useMemo(() => {
    if (groupBy === "none") return [{ label: null as string | null, items: sorted }];
    const map = new Map<string, Task[]>();
    for (const task of sorted) {
      const label =
        groupBy === "project"
          ? projectName(task.project_id) ?? "No project"
          : groupBy === "category"
            ? categories.find((c) => c.key === task.category)?.label ?? task.category
            : assigneeLabel(task.assigned_to_user_id) ?? "Unassigned";
      const list = map.get(label) ?? [];
      list.push(task);
      map.set(label, list);
    }
    return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
  }, [sorted, groupBy, projectName, categories, assigneeLabel]);

  return (
    <div className="panel-quiet overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <span className="label-mono">{tasks.length} task{tasks.length === 1 ? "" : "s"}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-text-lo">Group by</span>
          {(["none", "project", "category", "assignee"] as GroupBy[]).map((g) => (
            <Chip key={g} size="sm" active={groupBy === g} onClick={() => setGroupBy(g)}>
              {g === "none" ? "None" : g[0].toUpperCase() + g.slice(1)}
            </Chip>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-text-lo">
              <th className="w-8 px-3 py-2" />
              <SortHeader label="Title" k="title" active={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Category" k="category" active={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Priority" k="priority" active={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Due" k="due_date" active={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Assignee" k="assignee" active={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Project" k="project" active={sortKey} dir={sortDir} onClick={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <React.Fragment key={group.label ?? "all"}>
                {group.label ? (
                  <tr>
                    <td colSpan={7} className="bg-bg-2/40 px-3 py-1.5 text-xs text-text-lo">
                      {group.label} · {group.items.length}
                    </td>
                  </tr>
                ) : null}
                {group.items.map((task) => {
                  const category = categories.find((c) => c.key === task.category);
                  return (
                    <tr
                      key={task.id}
                      className={cn(
                        "cursor-pointer border-b border-line/60 transition-colors duration-hover hover:bg-bg-2/50",
                        selected.has(task.id) && "bg-ice/[0.06]"
                      )}
                      onClick={() => onOpen(task)}
                    >
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(task.id)}
                          onChange={() => onToggleSelect(task.id)}
                          className="size-3.5 accent-[var(--ice)]"
                          aria-label={`Select ${task.title}`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={task.status === "done"}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => void onToggleDone(task)}
                            className="size-3.5 accent-[var(--ice)]"
                            aria-label={`Mark ${task.title} done`}
                          />
                          <span className={task.status === "done" ? "text-text-lo line-through" : "text-text-hi"}>
                            {task.title}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className="rounded-chip border border-line bg-bg-2 px-2 py-0.5 text-xs text-text-lo"
                          style={taskCategoryChipStyle(category)}
                        >
                          {category?.label ?? task.category}
                        </span>
                      </td>
                      <td className={cn("px-3 py-2 text-xs", PRIORITY_TONE[task.priority])}>{PRIORITY_LABELS[task.priority]}</td>
                      <td className="px-3 py-2 font-data text-xs text-text-lo">
                        {task.due_date
                          ? new Date(`${task.due_date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-text-lo">{assigneeLabel(task.assigned_to_user_id) ?? "—"}</td>
                      <td className="px-3 py-2 text-xs text-text-lo">
                        {task.project_id ? projectName(task.project_id) ?? "—" : "—"}
                        {task.track_id ? ` ${trackName(task.track_id) ? "· " + trackName(task.track_id) : ""}` : ""}
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 ? <p className="px-4 py-8 text-center text-sm text-text-lo">No tasks match these filters.</p> : null}
      </div>
    </div>
  );
}

function SortHeader({
  label,
  k,
  active,
  dir,
  onClick,
}: {
  label: string;
  k: SortKey;
  active: SortKey;
  dir: 1 | -1;
  onClick: (k: SortKey) => void;
}) {
  return (
    <th className="px-3 py-2 font-medium">
      <button type="button" onClick={() => onClick(k)} className="inline-flex items-center gap-1 hover:text-text-hi">
        {label}
        {active === k ? dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : null}
      </button>
    </th>
  );
}
