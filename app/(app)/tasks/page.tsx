"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useActiveSpace } from "@/components/active-space-provider";
import { useProjects } from "@/hooks/use-projects";
import { useTaskMutations, useTasks } from "@/hooks/use-tasks";
import { useTracks } from "@/hooks/use-tracks";
import { TASK_CATEGORIES, TASK_STATUSES } from "@/lib/constants";
import {
  addDays,
  localDateString,
  startOfLocalDay,
} from "@/lib/format";
import type { Task, TaskCategory, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type Bucket = "overdue" | "today" | "week" | "later";

function bucketFor(task: Task, today: string): Bucket | null {
  if (task.status === "done") return null;
  if (!task.due_date) return "later";
  if (task.due_date < today) return "overdue";
  if (task.due_date === today) return "today";
  const weekEnd = localDateString(addDays(startOfLocalDay(), 7));
  if (task.due_date < weekEnd) return "week";
  return "later";
}

const BUCKET_LABELS: Record<Bucket, string> = {
  overdue: "Overdue",
  today: "Today",
  week: "This week",
  later: "Later",
};

export default function TasksPage() {
  const { data: tasks = [], isLoading } = useTasks();
  const { create, update, remove } = useTaskMutations();
  const { toast } = useToast();
  const { activeSpaceId } = useActiveSpace();
  const tracksQuery = useTracks(activeSpaceId);
  const projectsQuery = useProjects();

  const tracks = tracksQuery.data ?? [];
  const projects = projectsQuery.data ?? [];

  const [categoryFilter, setCategoryFilter] = React.useState<
    TaskCategory | "all"
  >("all");
  const [statusFilter, setStatusFilter] = React.useState<TaskStatus | "all">(
    "all"
  );

  const [title, setTitle] = React.useState("");
  const [category, setCategory] = React.useState<TaskCategory>("other");
  const [status, setStatus] = React.useState<TaskStatus>("todo");
  const [dueDate, setDueDate] = React.useState("");
  const [trackId, setTrackId] = React.useState("");
  const [projectId, setProjectId] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [showMore, setShowMore] = React.useState(false);

  const today = localDateString();

  const filtered = React.useMemo(() => {
    return tasks.filter((t) => {
      if (categoryFilter !== "all" && t.category !== categoryFilter)
        return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      return true;
    });
  }, [tasks, categoryFilter, statusFilter]);

  const grouped = React.useMemo(() => {
    const map: Record<Bucket, Task[]> = {
      overdue: [],
      today: [],
      week: [],
      later: [],
    };
    const done: Task[] = [];
    for (const t of filtered) {
      if (t.status === "done") {
        done.push(t);
        continue;
      }
      const b = bucketFor(t, today);
      if (b) map[b].push(t);
    }
    return { ...map, done };
  }, [filtered, today]);

  const trackName = React.useCallback(
    (id: string | null) => tracks.find((t) => t.id === id)?.title,
    [tracks]
  );
  const projectName = React.useCallback(
    (id: string | null) => projects.find((p) => p.id === id)?.name,
    [projects]
  );

  async function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await create.mutateAsync({
        title,
        category,
        status,
        due_date: dueDate || null,
        track_id: trackId || null,
        project_id: projectId || null,
        notes: notes || null,
      });
      setTitle("");
      setNotes("");
      setDueDate("");
      setTrackId("");
      setProjectId("");
      setShowMore(false);
      toast("Task added", "ok");
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Couldn’t add task — try again."
      );
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-semibold tracking-tight text-text-hi">
          Tasks
        </h1>
        <p className="mt-1 text-sm text-text-lo">
          Actionable stuff outside a single track — pitching, social, admin.
        </p>
      </div>

      <form
        onSubmit={handleQuickAdd}
        className="rounded-card border border-line bg-bg-1 p-4"
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a task…"
            className="flex-1"
          />
          <Button type="submit" disabled={!title.trim() || create.isPending}>
            Add
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {TASK_CATEGORIES.map((c) => (
            <Chip
              key={c.value}
              active={category === c.value}
              onClick={() => setCategory(c.value)}
            >
              {c.label}
            </Chip>
          ))}
        </div>
        <button
          type="button"
          className="mt-2 text-xs text-ice hover:underline"
          onClick={() => setShowMore((v) => !v)}
        >
          {showMore ? "Hide details" : "More details"}
        </button>
        {showMore ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="task-status">Status</Label>
              <select
                id="task-status"
                className="mt-1 h-9 w-full rounded-input border border-line bg-bg-2 px-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="task-due">Due date</Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="task-track">Link track</Label>
              <select
                id="task-track"
                className="mt-1 h-9 w-full rounded-input border border-line bg-bg-2 px-2 text-sm"
                value={trackId}
                onChange={(e) => setTrackId(e.target.value)}
              >
                <option value="">None</option>
                {tracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="task-project">Link project</Label>
              <select
                id="task-project"
                className="mt-1 h-9 w-full rounded-input border border-line bg-bg-2 px-2 text-sm"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="task-notes">Notes</Label>
              <Textarea
                id="task-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="mt-1"
              />
            </div>
          </div>
        ) : null}
      </form>

      <div className="flex flex-wrap gap-2">
        <Chip
          active={categoryFilter === "all"}
          onClick={() => setCategoryFilter("all")}
        >
          All categories
        </Chip>
        {TASK_CATEGORIES.map((c) => (
          <Chip
            key={c.value}
            active={categoryFilter === c.value}
            onClick={() => setCategoryFilter(c.value)}
          >
            {c.label}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Chip
          active={statusFilter === "all"}
          onClick={() => setStatusFilter("all")}
        >
          All statuses
        </Chip>
        {TASK_STATUSES.map((s) => (
          <Chip
            key={s.value}
            active={statusFilter === s.value}
            onClick={() => setStatusFilter(s.value)}
          >
            {s.label}
          </Chip>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-14 animate-pulse rounded-card bg-bg-1" />
          <div className="h-14 animate-pulse rounded-card bg-bg-1" />
        </div>
      ) : (
        <div className="space-y-6">
          {(["overdue", "today", "week", "later"] as Bucket[]).map(
            (bucket) => {
              const list = grouped[bucket];
              if (!list.length) return null;
              return (
                <section key={bucket}>
                  <h2
                    className={cn(
                      "mb-2 font-mono text-[11px] uppercase tracking-[0.08em]",
                      bucket === "overdue" ? "text-warn" : "text-text-lo"
                    )}
                  >
                    {BUCKET_LABELS[bucket]}
                    <span className="ml-2 text-text-lo/70">{list.length}</span>
                  </h2>
                  <ul className="space-y-2">
                    {list.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        trackTitle={trackName(task.track_id)}
                        projectTitle={projectName(task.project_id)}
                        overdue={bucket === "overdue"}
                        onToggle={async () => {
                          try {
                            await update.mutateAsync({
                              id: task.id,
                              patch: {
                                status:
                                  task.status === "done" ? "todo" : "done",
                              },
                            });
                          } catch (err) {
                            toast(
                              err instanceof Error
                                ? err.message
                                : "Couldn’t update task."
                            );
                          }
                        }}
                        onStatus={async (next) => {
                          try {
                            await update.mutateAsync({
                              id: task.id,
                              patch: { status: next },
                            });
                          } catch (err) {
                            toast(
                              err instanceof Error
                                ? err.message
                                : "Couldn’t update task."
                            );
                          }
                        }}
                        onDelete={async () => {
                          try {
                            await remove.mutateAsync(task.id);
                          } catch (err) {
                            toast(
                              err instanceof Error
                                ? err.message
                                : "Couldn’t delete task."
                            );
                          }
                        }}
                      />
                    ))}
                  </ul>
                </section>
              );
            }
          )}

          {grouped.done.length > 0 && statusFilter !== "todo" ? (
            <section>
              <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo">
                Done
                <span className="ml-2 text-text-lo/70">
                  {grouped.done.length}
                </span>
              </h2>
              <ul className="space-y-2 opacity-70">
                {grouped.done.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    trackTitle={trackName(task.track_id)}
                    projectTitle={projectName(task.project_id)}
                    overdue={false}
                    onToggle={async () => {
                      await update.mutateAsync({
                        id: task.id,
                        patch: { status: "todo" },
                      });
                    }}
                    onStatus={async (next) => {
                      await update.mutateAsync({
                        id: task.id,
                        patch: { status: next },
                      });
                    }}
                    onDelete={async () => {
                      await remove.mutateAsync(task.id);
                    }}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {!filtered.length ? (
            <p className="rounded-card border border-dashed border-line px-4 py-10 text-center text-sm text-text-lo">
              No tasks match these filters. Add one above.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task,
  trackTitle,
  projectTitle,
  overdue,
  onToggle,
  onStatus,
  onDelete,
}: {
  task: Task;
  trackTitle?: string;
  projectTitle?: string;
  overdue: boolean;
  onToggle: () => Promise<void>;
  onStatus: (s: TaskStatus) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [confirm, setConfirm] = React.useState(false);
  const cat =
    TASK_CATEGORIES.find((c) => c.value === task.category)?.label ??
    task.category;

  return (
    <li className="flex items-start gap-3 rounded-card border border-line bg-bg-1 px-3 py-2.5">
      <input
        type="checkbox"
        checked={task.status === "done"}
        onChange={() => void onToggle()}
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
          <span className="rounded-chip bg-bg-2 px-2 py-0.5 text-[11px] text-text-lo">
            {cat}
          </span>
          <select
            className="h-6 rounded-chip border border-line bg-bg-2 px-2 font-mono text-[10px] text-text-lo"
            value={task.status}
            onChange={(e) => void onStatus(e.target.value as TaskStatus)}
          >
            {TASK_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {task.due_date ? (
            <span
              className={cn(
                "font-mono text-[11px]",
                overdue ? "text-warn" : "text-text-lo"
              )}
            >
              {task.due_date}
            </span>
          ) : null}
          {task.track_id && trackTitle ? (
            <Link
              href={`/track/${task.track_id}`}
              className="rounded-chip bg-ice/10 px-2 py-0.5 text-[11px] text-ice hover:underline"
            >
              {trackTitle}
            </Link>
          ) : null}
          {task.project_id && projectTitle ? (
            <Link
              href={`/projects/${task.project_id}`}
              className="rounded-chip bg-amber/10 px-2 py-0.5 text-[11px] text-amber hover:underline"
            >
              {projectTitle}
            </Link>
          ) : null}
        </div>
        {task.notes ? (
          <p className="mt-1 text-xs text-text-lo">{task.notes}</p>
        ) : null}
      </div>
      {confirm ? (
        <span className="flex shrink-0 items-center gap-1 text-[11px]">
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
          className="shrink-0 text-[11px] text-text-lo hover:text-warn"
          onClick={() => setConfirm(true)}
        >
          Delete
        </button>
      )}
    </li>
  );
}
