"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { LayoutGroup } from "framer-motion";
import { FlareLine } from "@/components/flare-line";
import { SlitDivider } from "@/components/ui/slit";
import { useLayoutOverflowUnlock } from "@/components/ui/layout-item";
import { DraggableTaskRow } from "@/components/tasks/task-row";
import { TaskRescheduleDialog } from "@/components/tasks/task-reschedule-dialog";
import {
  TASK_BUCKETS,
  TASK_BUCKET_LABELS,
  TASK_BUCKET_MOVE_HINTS,
  bucketDropId,
  bucketForTask,
  dropNeedsDatePrompt,
  immediateDueDateForBucket,
  parseBucketDropId,
  type TaskBucket,
} from "@/lib/tasks/buckets";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

const bucketCollision: CollisionDetection = (args) => {
  const pointer = pointerWithin(args);
  if (pointer.length > 0) return pointer;
  return closestCorners(args);
};

const BUCKET_HUE: Record<TaskBucket, string> = {
  overdue: "var(--warn)",
  today: "var(--amber)",
  week: "#ffffff",
  later: "var(--ice)",
};

export function LanesView({
  tasks,
  today,
  editTaskId,
  trackName,
  projectName,
  assigneeLabel,
  onToggle,
  onDelete,
  onOpen,
  onReschedule,
}: {
  tasks: Task[];
  today: string;
  editTaskId: string | null;
  trackName: (id: string | null) => string | undefined;
  projectName: (id: string | null) => string | undefined;
  assigneeLabel: (id: string | null | undefined) => string | undefined;
  onToggle: (task: Task) => Promise<void>;
  onDelete: (task: Task) => Promise<void>;
  onOpen: (task: Task) => void;
  onReschedule: (taskId: string, dueDate: string | null) => Promise<void>;
}) {
  const [activeTask, setActiveTask] = React.useState<Task | null>(null);
  const [overBucket, setOverBucket] = React.useState<TaskBucket | null>(null);
  const [pendingMove, setPendingMove] = React.useState<{ task: Task; target: TaskBucket } | null>(null);
  const allowOverflow = useLayoutOverflowUnlock(Boolean(activeTask));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const grouped = React.useMemo(() => {
    const map: Record<TaskBucket, Task[]> = { overdue: [], today: [], week: [], later: [] };
    for (const t of tasks) {
      const b = bucketForTask(t, today);
      if (b) map[b].push(t);
    }
    return map;
  }, [tasks, today]);

  function handleDragStart(event: DragStartEvent) {
    const task = event.active.data.current?.task;
    if (task) setActiveTask(task as Task);
  }

  function handleDragOver(event: DragOverEvent) {
    const next = parseBucketDropId(event.over?.id);
    setOverBucket((prev) => (prev === next ? prev : next));
  }

  function clearDrag() {
    setActiveTask(null);
    setOverBucket(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const task = event.active.data.current?.task as Task | undefined;
    const target = parseBucketDropId(event.over?.id);
    clearDrag();
    if (!task || !target) return;
    const current = bucketForTask(task, today);
    if (current === target) return;
    if (!dropNeedsDatePrompt(target)) {
      void onReschedule(task.id, immediateDueDateForBucket(target, today));
      return;
    }
    setPendingMove({ task, target });
  }

  const sourceBucket = activeTask ? bucketForTask(activeTask, today) : null;

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={bucketCollision}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragCancel={clearDrag}
        onDragEnd={handleDragEnd}
      >
        <LayoutGroup id="tempo-tasks">
          <div className="grid gap-3 sm:grid-cols-2 lg:min-h-[248px] lg:grid-cols-4">
            {TASK_BUCKETS.map((bucket) => (
              <LaneColumn
                key={bucket}
                bucket={bucket}
                list={grouped[bucket]}
                editTaskId={editTaskId}
                trackName={trackName}
                projectName={projectName}
                assigneeLabel={assigneeLabel}
                onToggle={onToggle}
                onDelete={onDelete}
                onOpen={onOpen}
                isDragging={Boolean(activeTask)}
                isDropTarget={overBucket === bucket && sourceBucket !== bucket}
                allowOverflow={allowOverflow}
              />
            ))}
          </div>
        </LayoutGroup>
        <DragOverlay dropAnimation={null}>
          {activeTask ? (
            <div className="cursor-grabbing rounded-card border border-ice/40 bg-bg-1 px-3 py-2.5 shadow-raise">
              <p className="text-sm text-text-hi">{activeTask.title}</p>
              {overBucket && overBucket !== sourceBucket ? (
                <p className="mt-1 text-xs text-ice">{TASK_BUCKET_MOVE_HINTS[overBucket]}</p>
              ) : null}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <TaskRescheduleDialog
        task={pendingMove?.task ?? null}
        target={pendingMove?.target ?? null}
        today={today}
        onOpenChange={(open) => {
          if (!open) setPendingMove(null);
        }}
        onPick={(due) => {
          const move = pendingMove;
          setPendingMove(null);
          if (!move) return;
          void onReschedule(move.task.id, due);
        }}
      />
    </>
  );
}

function LaneColumn({
  bucket,
  list,
  editTaskId,
  trackName,
  projectName,
  assigneeLabel,
  onToggle,
  onDelete,
  onOpen,
  isDragging,
  isDropTarget,
  allowOverflow,
}: {
  bucket: TaskBucket;
  list: Task[];
  editTaskId: string | null;
  trackName: (id: string | null) => string | undefined;
  projectName: (id: string | null) => string | undefined;
  assigneeLabel: (id: string | null | undefined) => string | undefined;
  onToggle: (task: Task) => Promise<void>;
  onDelete: (task: Task) => Promise<void>;
  onOpen: (task: Task) => void;
  isDragging: boolean;
  isDropTarget: boolean;
  allowOverflow: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: bucketDropId(bucket), data: { bucket } });
  const urgent = bucket === "overdue" && list.length > 0 && !isDropTarget;

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "prism-edge relative flex min-h-[12rem] flex-col overflow-hidden rounded-panel border border-line bg-gradient-to-b from-[rgb(20_20_25_/_0.70)] to-[rgb(14_14_18_/_0.55)] p-4 shadow-e2 backdrop-blur-xl",
        urgent && "border-warn/40",
        isDragging && !isDropTarget && "border-ice/25",
        isDropTarget && "border-ice/55 bg-ice/10 ring-1 ring-ice/40",
        allowOverflow && "overflow-visible"
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-16"
        style={{
          backgroundImage: `linear-gradient(180deg, color-mix(in srgb, ${BUCKET_HUE[bucket]} 14%, transparent), color-mix(in srgb, ${BUCKET_HUE[bucket]} 5%, transparent) 45%, transparent)`,
        }}
      />
      <h2 className="relative mb-3 flex items-center gap-2">
        <span className={cn("label-mono", urgent && "text-warn")}>{TASK_BUCKET_LABELS[bucket]}</span>
        {list.length > 0 && !isDropTarget ? (
          <span className={cn("font-data text-xs tabular-nums", urgent ? "text-warn" : "text-text-lo/70")}>
            {list.length}
          </span>
        ) : null}
        <SlitDivider className="flex-1" />
      </h2>
      {isDropTarget ? (
        <p className="relative mb-3 rounded-input border border-ice/40 bg-ice/15 px-3 py-2 text-center text-sm text-ice">
          {TASK_BUCKET_MOVE_HINTS[bucket]}
        </p>
      ) : null}
      <ul className="relative space-y-2">
        {list.map((task) => (
          <DraggableTaskRow
            key={task.id}
            task={task}
            trackTitle={trackName(task.track_id)}
            projectTitle={projectName(task.project_id)}
            assigneeLabel={assigneeLabel(task.assigned_to_user_id)}
            overdue={bucket === "overdue"}
            focused={editTaskId === task.id}
            onToggle={() => onToggle(task)}
            onDelete={() => onDelete(task)}
            onOpen={() => onOpen(task)}
          />
        ))}
      </ul>
      {list.length === 0 && !isDropTarget ? <LaneEmpty bucket={bucket} /> : null}
    </section>
  );
}

function LaneEmpty({ bucket }: { bucket: TaskBucket }) {
  const copy: Record<TaskBucket, string> = {
    overdue: "Nothing overdue.",
    today: "Nothing due today.",
    week: "Clear for the rest of the week.",
    later: "Nothing parked for later.",
  };

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
      <FlareLine variant="tick" className="mb-1 !w-10 opacity-70" />
      <p className="text-xs leading-relaxed text-text-lo/70">{copy[bucket]}</p>
      {bucket === "today" ? (
        <button
          type="button"
          onClick={() => document.getElementById("task-composer")?.focus()}
          className="text-xs text-ice transition-colors duration-hover hover:underline"
        >
          Add a task
        </button>
      ) : null}
    </div>
  );
}
