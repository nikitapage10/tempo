"use client";

import { FlareLine } from "@/components/flare-line";
import { TaskRow } from "@/components/tasks/task-row";
import type { Task } from "@/lib/types";

function sortClosedOut(a: Task, b: Task) {
  if (a.due_date && b.due_date && a.due_date !== b.due_date) {
    return a.due_date < b.due_date ? 1 : -1;
  }
  if (a.due_date && !b.due_date) return -1;
  if (!a.due_date && b.due_date) return 1;
  return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0;
}

export function TaskDoneArchive({
  tasks,
  trackName,
  projectName,
  assigneeName,
  focusedId,
  onBack,
  onToggle,
  onDelete,
  onOpen,
}: {
  tasks: Task[];
  trackName: (id: string | null) => string | undefined;
  projectName: (id: string | null) => string | undefined;
  assigneeName: (id: string | null | undefined) => string | undefined;
  focusedId?: string | null;
  onBack?: () => void;
  onToggle: (task: Task) => Promise<void>;
  onDelete: (task: Task) => Promise<void>;
  onOpen: (task: Task) => void;
}) {
  const sorted = [...tasks].sort(sortClosedOut);

  return (
    <section className="panel-quiet p-5">
      <div className="mb-5 flex items-end gap-4">
        <p className="font-display text-4xl font-semibold tabular-nums leading-none text-ok">
          {tasks.length}
        </p>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold tracking-tight text-text-hi">
            Closed out
          </h2>
          <p className="text-sm text-text-lo">
            Everything you&apos;ve checked off in this space.
          </p>
        </div>
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="shrink-0 text-xs text-ice hover:underline"
          >
            Back to the board
          </button>
        ) : null}
      </div>
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <FlareLine variant="tick" className="mb-1 !w-10 opacity-70" />
          <p className="text-sm text-text-lo">
            Nothing closed out yet. Check one off and it&apos;ll land here.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {sorted.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              trackTitle={trackName(task.track_id)}
              projectTitle={projectName(task.project_id)}
              assigneeLabel={assigneeName(task.assigned_to_user_id)}
              overdue={false}
              focused={focusedId === task.id}
              onToggle={() => onToggle(task)}
              onDelete={() => onDelete(task)}
              onOpen={() => onOpen(task)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
