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
import { useSearchParams } from "next/navigation";
import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Chip } from "@/components/ui/chip";
import {
  FilterGroup,
  FilterSep,
  FilterToolbar,
} from "@/components/ui/filter-row";
import { FlareLine } from "@/components/flare-line";
import { SlitDivider } from "@/components/ui/slit";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useActiveSpace } from "@/components/active-space-provider";
import { useActiveArtist } from "@/components/active-artist-provider";
import { TaskDoneArchive } from "@/components/tasks/task-done-archive";
import { TaskRescheduleDialog } from "@/components/tasks/task-reschedule-dialog";
import { DraggableTaskRow } from "@/components/tasks/task-row";
import { TaskCategoryManager } from "@/components/tasks/task-category-manager";
import { useTaskCategoryPalette } from "@/components/tasks/task-category-provider";
import { useProjects } from "@/hooks/use-projects";
import { useTaskMutations, useTasks } from "@/hooks/use-tasks";
import { useTracks } from "@/hooks/use-tracks";
import { useActiveTeamRoster } from "@/hooks/use-artist-members";
import { useCurrentUser } from "@/hooks/use-current-user";
import { fetchMemberProfiles, fetchMyMemberProfile } from "@/lib/api/member-profile";
import { canRead, canWrite } from "@/lib/team/areas";
import { useWorkspaceMode } from "@/hooks/use-workspace-mode";
import { useQuery } from "@tanstack/react-query";
import { TASK_STATUSES } from "@/lib/constants";
import { localDateString } from "@/lib/format";
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
import { buildTaskAssigneeOptions } from "@/lib/tasks/assignee-label";
import type { Task, TaskCategory, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { taskCategoryChipStyle } from "@/lib/tasks/categories";

const bucketCollision: CollisionDetection = (args) => {
  const pointer = pointerWithin(args);
  if (pointer.length > 0) return pointer;
  return closestCorners(args);
};

export default function TasksPage() {
  return (
    <React.Suspense fallback={<div className="h-48 animate-pulse rounded-card bg-bg-1" />}>
      <TasksContent />
    </React.Suspense>
  );
}

function TasksContent() {
  const searchParams = useSearchParams();
  const editTaskId = searchParams.get("edit");
  const { toast } = useToast();
  const { activeSpaceId } = useActiveSpace();
  const { activeArtist } = useActiveArtist();
  const { categories } = useTaskCategoryPalette();
  const workspace = useWorkspaceMode();
  const currentUser = useCurrentUser();
  const { data: tasks = [], isLoading } = useTasks(activeSpaceId);
  const { create, update, remove, assign } = useTaskMutations(activeSpaceId);
  const rosterQuery = useActiveTeamRoster(activeArtist?.id ?? null);
  const eligibleMembers = React.useMemo(() => (rosterQuery.data ?? []).filter((member) => member.userId && canRead(member.areas, "tasks")), [rosterQuery.data]);
  const eligibleIds = React.useMemo(() => eligibleMembers.map((member) => member.userId!), [eligibleMembers]);
  const myProfileQuery = useQuery({
    queryKey: ["my-member-profile"],
    queryFn: fetchMyMemberProfile,
    enabled: Boolean(currentUser),
    staleTime: 30_000,
  });
  const profileIds = React.useMemo(() => {
    const ids = new Set(eligibleIds);
    if (currentUser) ids.add(currentUser.id);
    if (activeArtist?.user_id) ids.add(activeArtist.user_id);
    return Array.from(ids);
  }, [eligibleIds, currentUser, activeArtist?.user_id]);
  const memberProfiles = useQuery({
    queryKey: ["member-profiles", "task-assignees", profileIds.slice().sort()],
    queryFn: () => fetchMemberProfiles(profileIds),
    enabled: profileIds.length > 0,
    staleTime: 30_000,
  });
  const assignees = React.useMemo(() => {
    const memberNames = new Map<string, string | null>();
    memberProfiles.data?.forEach((profile, id) => {
      memberNames.set(id, profile.displayName);
    });
    return buildTaskAssigneeOptions({
      currentUserId: currentUser?.id ?? null,
      currentUserEmail: currentUser?.email ?? null,
      currentUserName: myProfileQuery.data?.displayName ?? null,
      ownerUserId: activeArtist?.user_id ?? currentUser?.id ?? null,
      ownerWorkspaceName: activeArtist?.name ?? null,
      memberNames,
      eligibleUserIds: eligibleIds,
    });
  }, [
    currentUser,
    myProfileQuery.data,
    activeArtist?.user_id,
    activeArtist?.name,
    memberProfiles.data,
    eligibleIds,
  ]);
  const tracksQuery = useTracks(activeSpaceId);
  const projectsQuery = useProjects(activeSpaceId);

  const tracks = React.useMemo(
    () => tracksQuery.data ?? [],
    [tracksQuery.data]
  );
  const projects = React.useMemo(
    () => projectsQuery.data ?? [],
    [projectsQuery.data]
  );

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
  const [assigneeId, setAssigneeId] = React.useState("");
  const [trackId, setTrackId] = React.useState("");
  const [projectId, setProjectId] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [showMore, setShowMore] = React.useState(false);
  const [activeTask, setActiveTask] = React.useState<Task | null>(null);
  const [categoryManagerOpen, setCategoryManagerOpen] = React.useState(false);
  const [overBucket, setOverBucket] = React.useState<TaskBucket | null>(null);
  const [pendingMove, setPendingMove] = React.useState<{
    task: Task;
    target: TaskBucket;
  } | null>(null);

  const today = localDateString();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );
  const reducedMotion = usePrefersReducedMotion();

  React.useEffect(() => {
    if (!categories.some((item) => item.key === category)) setCategory("other");
    if (
      categoryFilter !== "all" &&
      !categories.some((item) => item.key === categoryFilter)
    ) {
      setCategoryFilter("all");
    }
  }, [categories, category, categoryFilter]);

  React.useEffect(() => {
    if (!editTaskId || isLoading) return;
    const target = tasks.find((t) => t.id === editTaskId);
    if (target?.status === "done") setStatusFilter("done");
    else setStatusFilter("all");
    setCategoryFilter("all");
    const timer = window.setTimeout(() => {
      document.getElementById(`task-${editTaskId}`)?.scrollIntoView({
        block: "center",
        behavior: reducedMotion ? "auto" : "smooth",
      });
      document
        .querySelector<HTMLInputElement>(`#task-${editTaskId} input[type="date"]`)
        ?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [editTaskId, isLoading, tasks, reducedMotion]);

  const filtered = React.useMemo(() => {
    return tasks.filter((t) => {
      if (categoryFilter !== "all" && t.category !== categoryFilter)
        return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      return true;
    });
  }, [tasks, categoryFilter, statusFilter]);

  const grouped = React.useMemo(() => {
    const map: Record<TaskBucket, Task[]> = {
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
      const b = bucketForTask(t, today);
      if (b) map[b].push(t);
    }
    return { ...map, done };
  }, [filtered, today]);

  const doneCount = React.useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.status === "done" &&
          (categoryFilter === "all" || t.category === categoryFilter)
      ).length,
    [tasks, categoryFilter]
  );

  const showingDone = statusFilter === "done";

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
      const task = await create.mutateAsync({
        title,
        category,
        status,
        due_date: dueDate || null,
        track_id: trackId || null,
        project_id: projectId || null,
        notes: notes || null,
      });
      let assignmentFailed = false;
      if (assigneeId) {
        try {
          await assign.mutateAsync({ id: task.id, userId: assigneeId });
        } catch {
          assignmentFailed = true;
        }
      }
      setTitle("");
      setNotes("");
      setDueDate("");
      setAssigneeId("");
      setTrackId("");
      setProjectId("");
      setShowMore(false);
      toast(
        assignmentFailed
          ? "Task added, but the assignee couldn’t be set."
          : "Task added",
        assignmentFailed ? undefined : "ok"
      );
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Couldn’t add task — try again."
      );
    }
  }

  async function patchTask(id: string, patch: { status?: TaskStatus; due_date?: string | null }) {
    try {
      await update.mutateAsync({ id, patch });
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Couldn’t update task."
      );
    }
  }

  async function deleteTask(id: string) {
    try {
      await remove.mutateAsync(id);
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Couldn’t delete task."
      );
    }
  }

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
      void patchTask(task.id, {
        due_date: immediateDueDateForBucket(target, today),
      });
      return;
    }
    setPendingMove({ task, target });
  }

  const sourceBucket = activeTask ? bucketForTask(activeTask, today) : null;

  function rowHandlers(task: Task) {
    return {
      onToggle: () =>
        patchTask(task.id, {
          status: task.status === "done" ? "todo" : "done",
        }),
      onStatus: (next: TaskStatus) => patchTask(task.id, { status: next }),
      onDue: (next: string) => patchTask(task.id, { due_date: next || null }),
      onDelete: () => deleteTask(task.id),
      assignees,
      onAssign: async (userId: string | null) => {
        try { await assign.mutateAsync({ id: task.id, userId }); toast(userId ? "Task assigned." : "Task unassigned.", "ok"); }
        catch (err) { toast(err instanceof Error ? err.message : "Couldn’t change the assignee."); }
      },
    };
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tasks"
        actions={
          <Button type="button" variant="secondary" onClick={() => setCategoryManagerOpen(true)}>
            <Palette /> Categories
          </Button>
        }
        subtitle="Actionable stuff outside a single track — pitching, social, admin."
      />

      <form onSubmit={handleQuickAdd} className="panel p-5">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="task-title"
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
          {categories.map((c) => (
            <Chip
              key={c.key}
              active={category === c.key}
              style={taskCategoryChipStyle(c, category === c.key)}
              onClick={() => setCategory(c.key)}
            >
              {c.label}
            </Chip>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
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
            <Label htmlFor="task-assignee">Assignee</Label>
            <select
              id="task-assignee"
              className="mt-1 h-9 w-full rounded-input border border-line bg-bg-2 px-2 text-sm"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
            >
              <option value="">Unassigned</option>
              {assignees.map((person) => (
                <option key={person.userId} value={person.userId}>
                  {person.label}
                </option>
              ))}
            </select>
          </div>
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

      <FilterToolbar className="mb-4">
        <FilterGroup label="Type">
          <Chip
            size="sm"
            active={categoryFilter === "all"}
            onClick={() => setCategoryFilter("all")}
          >
            All
          </Chip>
          {categories.map((c) => (
            <Chip
              key={c.key}
              size="sm"
              active={categoryFilter === c.key}
              style={taskCategoryChipStyle(c, categoryFilter === c.key)}
              onClick={() => setCategoryFilter(c.key)}
            >
              {c.label}
            </Chip>
          ))}
        </FilterGroup>
        <FilterSep />
        <FilterGroup label="Show">
          <Chip
            size="sm"
            active={statusFilter === "all"}
            onClick={() => setStatusFilter("all")}
          >
            All
          </Chip>
          {TASK_STATUSES.map((s) => (
            <Chip
              key={s.value}
              size="sm"
              active={statusFilter === s.value}
              className={
                s.value === "done" && statusFilter === "done"
                  ? "border-ok/40 bg-ok/10 text-ok"
                  : undefined
              }
              onClick={() => setStatusFilter(s.value)}
            >
              {s.label === "Done" ? "Closed out" : s.label}
              {s.value === "done" && doneCount > 0 ? (
                <span className="ml-1 font-data tabular-nums text-ok">
                  {doneCount}
                </span>
              ) : null}
            </Chip>
          ))}
          {categoryFilter !== "all" || statusFilter !== "all" ? (
            <button
              type="button"
              onClick={() => {
                setCategoryFilter("all");
                setStatusFilter("all");
              }}
              className="ml-1 text-xs text-ice hover:underline"
            >
              Clear
            </button>
          ) : null}
        </FilterGroup>
      </FilterToolbar>

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-14 animate-pulse rounded-card bg-bg-1" />
          <div className="h-14 animate-pulse rounded-card bg-bg-1" />
        </div>
      ) : showingDone ? (
        <TaskDoneArchive
          tasks={grouped.done}
          trackName={trackName}
          projectName={projectName}
          focusedId={editTaskId}
          onBack={() => setStatusFilter("all")}
          onToggle={(task) => rowHandlers(task).onToggle()}
          onStatus={(task, next) => rowHandlers(task).onStatus(next)}
          onDue={(task, next) => rowHandlers(task).onDue(next)}
          onDelete={(task) => rowHandlers(task).onDelete()}
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={bucketCollision}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragCancel={clearDrag}
          onDragEnd={handleDragEnd}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:min-h-[248px] lg:grid-cols-4">
            {TASK_BUCKETS.map((bucket) => (
              <TaskBucketColumn
                key={bucket}
                bucket={bucket}
                list={grouped[bucket]}
                editTaskId={editTaskId}
                trackName={trackName}
                projectName={projectName}
                rowHandlers={rowHandlers}
                isDragging={Boolean(activeTask)}
                isDropTarget={
                  overBucket === bucket && sourceBucket !== bucket
                }
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setStatusFilter("done")}
            className="well mt-3 flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-hover hover:bg-bg-2/80"
          >
            <span>
              <span className="text-sm text-text-hi">Closed out</span>
              <span className="mt-0.5 block text-xs text-text-lo">
                What you’ve checked off in this space.
              </span>
            </span>
            <span className="font-display text-xl tabular-nums text-ok">
              {doneCount}
            </span>
          </button>
          <DragOverlay dropAnimation={reducedMotion ? null : undefined}>
            {activeTask ? (
              <div className="cursor-grabbing rounded-card border border-ice/40 bg-bg-1 px-3 py-2.5 shadow-raise">
                <p className="text-sm text-text-hi">{activeTask.title}</p>
                {overBucket && overBucket !== sourceBucket ? (
                  <p className="mt-1 text-xs text-ice">
                    {TASK_BUCKET_MOVE_HINTS[overBucket]}
                  </p>
                ) : null}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {!isLoading &&
      !filtered.length &&
      (categoryFilter !== "all" || statusFilter !== "all") &&
      !showingDone ? (
        <p className="well mt-4 px-4 py-6 text-center text-sm text-text-lo">
          No tasks match these filters.
        </p>
      ) : null}

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
          void patchTask(move.task.id, { due_date: due });
        }}
      />
      <TaskCategoryManager
        open={categoryManagerOpen}
        onClose={() => setCategoryManagerOpen(false)}
        canManage={workspace.mode !== "entered" || canWrite(workspace.areas, "tasks")}
      />
    </div>
  );
}

function TaskBucketColumn({
  bucket,
  list,
  editTaskId,
  trackName,
  projectName,
  rowHandlers,
  isDragging,
  isDropTarget,
}: {
  bucket: TaskBucket;
  list: Task[];
  editTaskId: string | null;
  trackName: (id: string | null) => string | undefined;
  projectName: (id: string | null) => string | undefined;
  rowHandlers: (task: Task) => {
    onToggle: () => Promise<void>;
    onStatus: (s: TaskStatus) => Promise<void>;
    onDue: (date: string) => Promise<void>;
    onDelete: () => Promise<void>;
  };
  isDragging: boolean;
  isDropTarget: boolean;
}) {
  const { setNodeRef } = useDroppable({
    id: bucketDropId(bucket),
    data: { bucket },
  });
  const urgent = bucket === "overdue" && list.length > 0 && !isDropTarget;

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "relative flex min-h-[12rem] flex-col p-4",
        urgent ? "panel border-warn/40" : "panel-quiet",
        isDragging && !isDropTarget && "border-ice/25",
        isDropTarget && "border-ice/55 bg-ice/10 ring-1 ring-ice/40"
      )}
    >
      <h2 className="mb-3 flex items-center gap-2">
        <span className={cn("label-mono", urgent && "text-warn")}>
          {TASK_BUCKET_LABELS[bucket]}
        </span>
        {list.length > 0 && !isDropTarget ? (
          <span
            className={cn(
              "font-mono text-xs tabular-nums",
              urgent ? "text-warn" : "text-text-lo/70"
            )}
          >
            {list.length}
          </span>
        ) : null}
        <SlitDivider className="flex-1" />
      </h2>
      {isDropTarget ? (
        <p className="mb-3 rounded-input border border-ice/40 bg-ice/15 px-3 py-2 text-center text-sm text-ice">
          {TASK_BUCKET_MOVE_HINTS[bucket]}
        </p>
      ) : null}
      <ul className="space-y-2">
        {list.map((task) => (
          <DraggableTaskRow
            key={task.id}
            task={task}
            trackTitle={trackName(task.track_id)}
            projectTitle={projectName(task.project_id)}
            overdue={bucket === "overdue"}
            focused={editTaskId === task.id}
            {...rowHandlers(task)}
          />
        ))}
      </ul>
      {list.length === 0 && !isDropTarget ? (
        <BucketEmpty bucket={bucket} />
      ) : null}
    </section>
  );
}

/**
 * A calm invitation rather than blank space. Only the "today" column offers an
 * action — four identical buttons would be the busywork we're avoiding.
 */
function BucketEmpty({ bucket }: { bucket: TaskBucket }) {
  const copy: Record<TaskBucket, string> = {
    overdue: "Nothing overdue.",
    today: "Nothing due today.",
    week: "Clear for the rest of the week.",
    later: "Nothing parked for later.",
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
      <FlareLine variant="tick" className="mb-1 !w-10 opacity-70" />
      <p className="text-xs leading-relaxed text-text-lo/70">
        {copy[bucket]}
      </p>
      {bucket === "today" ? (
        <button
          type="button"
          onClick={() => document.getElementById("task-title")?.focus()}
          className="text-xs text-ice transition-colors duration-hover hover:underline"
        >
          Add a task
        </button>
      ) : null}
    </div>
  );
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}
