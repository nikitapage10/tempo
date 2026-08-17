"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Trash2, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTaskCategoryPalette } from "@/components/tasks/task-category-provider";
import { useTaskSteps, useTaskStepMutations } from "@/hooks/use-task-steps";
import { taskCategoryChipStyle } from "@/lib/tasks/categories";
import { RECURRENCE_LABELS } from "@/lib/tasks/recurrence";
import { TASK_STATUSES } from "@/lib/constants";
import type { Task, TaskPriority, TaskRecurrence, TaskStatus, TaskUpdate } from "@/lib/types";
import { cn } from "@/lib/utils";

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  0: "None",
  1: "Low",
  2: "High",
  3: "Urgent",
};

const PRIORITY_TONE: Record<TaskPriority, string> = {
  0: "",
  1: "border-ice/40 bg-ice/10 text-ice",
  2: "border-amber/40 bg-amber/10 text-amber",
  3: "border-warn/40 bg-warn/10 text-warn",
};

const REMINDER_OPTIONS = [15, 30, 60, 1440, 10080];
const REMINDER_LABELS: Record<number, string> = {
  15: "15 min before",
  30: "30 min before",
  60: "1 hour before",
  1440: "1 day before",
  10080: "1 week before",
};

export function TaskDrawer({
  task,
  trackTitle,
  projectTitle,
  assignees,
  projects,
  tracks,
  onUpdate,
  onAssign,
  onDelete,
  onClose,
}: {
  task: Task | null;
  trackTitle?: string;
  projectTitle?: string;
  assignees: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string }>;
  tracks: Array<{ id: string; name: string }>;
  onUpdate: (id: string, patch: TaskUpdate) => Promise<void>;
  onAssign: (id: string, userId: string | null) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const { categories } = useTaskCategoryPalette();
  const [title, setTitle] = React.useState(task?.title ?? "");
  const [notes, setNotes] = React.useState(task?.notes ?? "");
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [newStep, setNewStep] = React.useState("");

  const stepsQuery = useTaskSteps(task?.id ?? null);
  const stepMutations = useTaskStepMutations(task?.id ?? null);
  const steps = stepsQuery.data ?? [];

  React.useEffect(() => {
    setTitle(task?.title ?? "");
    setNotes(task?.notes ?? "");
    setConfirmDelete(false);
  }, [task?.id, task?.title, task?.notes]);

  if (!task) return null;

  const category = categories.find((c) => c.key === task.category);

  function toggleReminder(minutes: number) {
    if (!task) return;
    const next = task.reminder_minutes.includes(minutes)
      ? task.reminder_minutes.filter((m) => m !== minutes)
      : [...task.reminder_minutes, minutes];
    void onUpdate(task.id, { reminder_minutes: next });
  }

  return (
    <Dialog open={Boolean(task)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent title="" onClose={onClose} className="max-w-xl">
        <div className="-mt-2 mb-3 flex items-start gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== task.title && void onUpdate(task.id, { title: title.trim() })}
            className="min-w-0 flex-1 bg-transparent font-display text-xl font-semibold text-text-hi focus-visible:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map((c) => (
            <Chip
              key={c.key}
              size="sm"
              active={task.category === c.key}
              style={taskCategoryChipStyle(c, task.category === c.key)}
              onClick={() => void onUpdate(task.id, { category: c.key })}
            >
              {c.label}
            </Chip>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Status</Label>
            <select
              className="mt-1 h-9 w-full rounded-input border border-line bg-bg-2 px-2 text-sm"
              value={task.status}
              onChange={(e) => void onUpdate(task.id, { status: e.target.value as TaskStatus })}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Due date</Label>
            <input
              type="date"
              value={task.due_date ?? ""}
              onChange={(e) => void onUpdate(task.id, { due_date: e.target.value || null })}
              className="mt-1 h-9 w-full rounded-input border border-line bg-bg-2 px-2 text-sm text-text-hi"
            />
          </div>
          <div>
            <Label>Priority</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {([0, 1, 2, 3] as TaskPriority[]).map((p) => (
                <Chip
                  key={p}
                  size="sm"
                  active={task.priority === p}
                  className={task.priority === p ? PRIORITY_TONE[p] || undefined : undefined}
                  onClick={() => void onUpdate(task.id, { priority: p })}
                >
                  {PRIORITY_LABELS[p]}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <Label>Assignee</Label>
            <select
              className="mt-1 h-9 w-full rounded-input border border-line bg-bg-2 px-2 text-sm"
              value={task.assigned_to_user_id ?? ""}
              onChange={(e) => void onAssign(task.id, e.target.value || null)}
            >
              <option value="">Unassigned</option>
              {assignees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Project</Label>
            <select
              className="mt-1 h-9 w-full rounded-input border border-line bg-bg-2 px-2 text-sm"
              value={task.project_id ?? ""}
              onChange={(e) => void onUpdate(task.id, { project_id: e.target.value || null })}
            >
              <option value="">None</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {task.project_id && projectTitle ? (
              <Link href={`/projects/${task.project_id}`} className="mt-1 block text-xs text-ice hover:underline">
                Open project
              </Link>
            ) : null}
          </div>
          <div>
            <Label>Track</Label>
            <select
              className="mt-1 h-9 w-full rounded-input border border-line bg-bg-2 px-2 text-sm"
              value={task.track_id ?? ""}
              onChange={(e) => void onUpdate(task.id, { track_id: e.target.value || null })}
            >
              <option value="">None</option>
              {tracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {task.track_id && trackTitle ? (
              <Link href={`/track/${task.track_id}`} className="mt-1 block text-xs text-ice hover:underline">
                Open track
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-4">
          <Label>Steps</Label>
          <ul className="mt-1.5 space-y-1">
            {steps.map((step) => (
              <li key={step.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={step.done}
                  onChange={() => stepMutations.update.mutate({ id: step.id, patch: { done: !step.done } })}
                  className="size-3.5 accent-[var(--ice)]"
                />
                <span className={cn("flex-1 text-sm", step.done ? "text-text-lo line-through" : "text-text-hi")}>
                  {step.label}
                </span>
                <button
                  type="button"
                  onClick={() => stepMutations.remove.mutate(step.id)}
                  className="text-text-lo hover:text-warn"
                  aria-label={`Remove step ${step.label}`}
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newStep.trim()) return;
              stepMutations.create.mutate({ label: newStep.trim(), sortOrder: steps.length });
              setNewStep("");
            }}
          >
            <input
              value={newStep}
              onChange={(e) => setNewStep(e.target.value)}
              placeholder="Add a step…"
              className="h-8 min-w-0 flex-1 rounded-input border border-line bg-bg-2 px-2 text-xs text-text-hi placeholder:text-text-lo"
            />
            <Button type="submit" size="icon" variant="ghost" aria-label="Add step">
              <Plus className="size-3.5" />
            </Button>
          </form>
        </div>

        <div className="mt-4">
          <Label>Notes</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== (task.notes ?? "") && void onUpdate(task.id, { notes: notes || null })}
            rows={3}
            className="mt-1"
          />
        </div>

        <div className="mt-4">
          <Label>Remind me</Label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {REMINDER_OPTIONS.map((m) => (
              <Chip key={m} size="sm" active={task.reminder_minutes.includes(m)} onClick={() => toggleReminder(m)}>
                {REMINDER_LABELS[m]}
              </Chip>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <Label>Repeats</Label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Chip size="sm" active={!task.recurrence} onClick={() => void onUpdate(task.id, { recurrence: null })}>
              Doesn&apos;t repeat
            </Chip>
            {(Object.keys(RECURRENCE_LABELS) as TaskRecurrence[]).map((r) => (
              <Chip
                key={r}
                size="sm"
                active={task.recurrence === r}
                onClick={() => void onUpdate(task.id, { recurrence: r })}
              >
                {RECURRENCE_LABELS[r]}
              </Chip>
            ))}
          </div>
          {task.recurrence ? (
            <div className="mt-2">
              <Label>Stops after (optional)</Label>
              <input
                type="date"
                value={task.recurrence_until ?? ""}
                onChange={(e) => void onUpdate(task.id, { recurrence_until: e.target.value || null })}
                className="mt-1 h-9 w-full rounded-input border border-line bg-bg-2 px-2 text-sm text-text-hi"
              />
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2 border-t border-line pt-4">
          {confirmDelete ? (
            <>
              <span className="text-xs text-text-lo">Delete this task?</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  void onDelete(task.id);
                  onClose();
                }}
              >
                Delete
              </Button>
            </>
          ) : (
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-3.5" /> Delete task
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
