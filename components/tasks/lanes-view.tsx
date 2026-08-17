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
import { DropIndicator } from "@/components/ui/drop-indicator";
import { useLayoutOverflowUnlock } from "@/components/ui/layout-item";
import { useActiveSpace } from "@/components/active-space-provider";
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
  taskDragId,
  type TaskBucket,
} from "@/lib/tasks/buckets";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { insertIdBefore, isNoOpInsert } from "@/lib/dnd/insert";
import {
  parseDropSlotId,
  sameDropSlot,
  type DropSlot,
} from "@/lib/dnd/drop-slot";
import {
  applyTaskLaneOrder,
  readTaskLaneOrder,
  writeTaskLaneOrder,
  type TaskLaneOrderMap,
} from "@/lib/tasks/lane-order";

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
  const { activeSpaceId } = useActiveSpace();
  const [activeTask, setActiveTask] = React.useState<Task | null>(null);
  const [overBucket, setOverBucket] = React.useState<TaskBucket | null>(null);
  const [overSlot, setOverSlot] = React.useState<DropSlot | null>(null);
  const [laneOrder, setLaneOrder] = React.useState<TaskLaneOrderMap>(() =>
    readTaskLaneOrder(activeSpaceId)
  );
  const [pendingMove, setPendingMove] = React.useState<{ task: Task; target: TaskBucket } | null>(null);
  const allowOverflow = useLayoutOverflowUnlock(Boolean(activeTask));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  React.useEffect(() => {
    setLaneOrder(readTaskLaneOrder(activeSpaceId));
  }, [activeSpaceId]);

  function persistLaneOrder(next: TaskLaneOrderMap) {
    setLaneOrder(next);
    if (activeSpaceId) writeTaskLaneOrder(activeSpaceId, next);
  }

  const grouped = React.useMemo(() => {
    const map: Record<TaskBucket, Task[]> = { overdue: [], today: [], week: [], later: [] };
    for (const t of tasks) {
      const b = bucketForTask(t, today);
      if (b) map[b].push(t);
    }
    for (const bucket of TASK_BUCKETS) {
      map[bucket] = applyTaskLaneOrder(map[bucket], bucket, laneOrder);
    }
    return map;
  }, [tasks, today, laneOrder]);

  function taskIdsInBucket(bucket: TaskBucket, excludeId?: string) {
    return grouped[bucket]
      .filter((task) => task.id !== excludeId)
      .map((task) => task.id);
  }

  function resolveTaskSlot(overId: string): DropSlot | null {
    const slot = parseDropSlotId(overId);
    if (slot?.kind === "task") return slot;
    const bucket = parseBucketDropId(overId);
    if (bucket) {
      return { kind: "task", containerId: bucket, beforeId: null };
    }
    const taskId = overId.startsWith("task:") ? overId.slice(5) : null;
    if (taskId) {
      const task = tasks.find((item) => item.id === taskId);
      const b = task ? bucketForTask(task, today) : null;
      return b ? { kind: "task", containerId: b, beforeId: taskId } : null;
    }
    return null;
  }

  function clearDrag() {
    setActiveTask(null);
    setOverBucket(null);
    setOverSlot(null);
  }

  function handleDragStart(event: DragStartEvent) {
    const task = event.active.data.current?.task;
    if (task) setActiveTask(task as Task);
  }

  function handleDragOver(event: DragOverEvent) {
    const overId = event.over?.id;
    if (!overId) {
      setOverBucket(null);
      setOverSlot(null);
      return;
    }
    const id = String(overId);
    const bucket = parseBucketDropId(id) ?? parseDropSlotId(id)?.containerId as TaskBucket | undefined ?? null;
    setOverBucket(bucket);
    const slot = resolveTaskSlot(id);
    const activeId = String(event.active.id);
    const activeTaskId = activeId.startsWith("task:") ? activeId.slice(5) : activeId;
    if (slot && slot.beforeId !== activeTaskId) {
      setOverSlot((prev) => (sameDropSlot(prev, slot) ? prev : slot));
    } else {
      setOverSlot(null);
    }
  }

  function applyLanePlacement(taskId: string, bucket: TaskBucket, beforeId: string | null) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    const sourceBucket = bucketForTask(task, today);
    if (!sourceBucket) return;

    const sameBucket = sourceBucket === bucket;
    const originalIds = sameBucket ? grouped[bucket].map((item) => item.id) : [];
    const targetIds = taskIdsInBucket(bucket, taskId);
    const nextIds = insertIdBefore(targetIds, taskId, beforeId);
    if (sameBucket && isNoOpInsert(originalIds, taskId, beforeId)) return;

    const nextOrder: TaskLaneOrderMap = { ...laneOrder };
    for (const key of TASK_BUCKETS) {
      if (key === sourceBucket && key !== bucket && nextOrder[key]) {
        nextOrder[key] = nextOrder[key]!.filter((id) => id !== taskId);
      }
    }
    nextOrder[bucket] = nextIds;
    persistLaneOrder(nextOrder);

    if (!sameBucket) {
      if (!dropNeedsDatePrompt(bucket)) {
        void onReschedule(taskId, immediateDueDateForBucket(bucket, today));
        return;
      }
      setPendingMove({ task, target: bucket });
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const task = event.active.data.current?.task as Task | undefined;
    const slot = overSlot;
    clearDrag();
    const { over } = event;
    if (!task || !over) return;

    const resolved = slot ?? resolveTaskSlot(String(over.id));
    if (!resolved || resolved.kind !== "task") return;
    const target = resolved.containerId as TaskBucket;
    if (!TASK_BUCKETS.includes(target)) return;
    applyLanePlacement(task.id, target, resolved.beforeId);
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
                showInsertSlots={Boolean(activeTask)}
                activeSlot={overSlot?.kind === "task" && overSlot.containerId === bucket ? overSlot : null}
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
  showInsertSlots,
  activeSlot,
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
  showInsertSlots: boolean;
  activeSlot: DropSlot | null;
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
          <React.Fragment key={task.id}>
            {showInsertSlots ? (
              <DropIndicator
                slot={{ kind: "task", containerId: bucket, beforeId: task.id }}
                active={
                  activeSlot?.containerId === bucket &&
                  activeSlot.beforeId === task.id
                }
              />
            ) : null}
            <DraggableTaskRow
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
          </React.Fragment>
        ))}
        {showInsertSlots ? (
          <DropIndicator
            slot={{ kind: "task", containerId: bucket, beforeId: null }}
            active={
              activeSlot?.containerId === bucket && activeSlot.beforeId == null
            }
          />
        ) : null}
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
