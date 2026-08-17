"use client";

import * as React from "react";
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
import { useToast } from "@/components/ui/toast";
import { useActiveSpace } from "@/components/active-space-provider";
import { useActiveArtist } from "@/components/active-artist-provider";
import { TaskDoneArchive } from "@/components/tasks/task-done-archive";
import { TaskCategoryManager } from "@/components/tasks/task-category-manager";
import { TaskComposer, type TaskComposerResult } from "@/components/tasks/task-composer";
import { TaskDrawer } from "@/components/tasks/task-drawer";
import { LanesView } from "@/components/tasks/lanes-view";
import { ListView } from "@/components/tasks/list-view";
import { TimelineView } from "@/components/tasks/timeline-view";
import { TaskBulkBar } from "@/components/tasks/task-bulk-bar";
import { useTaskCategoryPalette } from "@/components/tasks/task-category-provider";
import { useProjects } from "@/hooks/use-projects";
import { useTaskMutations, useTasks } from "@/hooks/use-tasks";
import { useTracks } from "@/hooks/use-tracks";
import { createTaskStep } from "@/lib/api/task-steps";
import { browserTimezone } from "@/lib/calendar/date";
import { useActiveTeamRoster } from "@/hooks/use-artist-members";
import { useCurrentUser } from "@/hooks/use-current-user";
import { fetchMemberProfiles, fetchMyMemberProfile } from "@/lib/api/member-profile";
import { canRead, canWrite } from "@/lib/team/areas";
import { useWorkspaceMode } from "@/hooks/use-workspace-mode";
import { useQuery } from "@tanstack/react-query";
import { TASK_STATUSES } from "@/lib/constants";
import { localDateString } from "@/lib/format";
import { nextDueDate, recurrenceExhausted } from "@/lib/tasks/recurrence";
import { buildTaskAssigneeOptions } from "@/lib/tasks/assignee-label";
import type { Task, TaskCategory, TaskPriority, TaskStatus, TaskUpdate } from "@/lib/types";
import { taskCategoryChipStyle } from "@/lib/tasks/categories";

type TaskView = "lanes" | "list" | "timeline";
const VIEWS: TaskView[] = ["lanes", "list", "timeline"];
const VIEW_LABELS: Record<TaskView, string> = { lanes: "Lanes", list: "List", timeline: "Timeline" };

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
  const { create, update, remove, assign, bulkUpdate, bulkRemove } = useTaskMutations(activeSpaceId);
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

  const tracks = React.useMemo(() => tracksQuery.data ?? [], [tracksQuery.data]);
  const projects = React.useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);

  const [categoryFilter, setCategoryFilter] = React.useState<TaskCategory | "all">("all");
  const [statusFilter, setStatusFilter] = React.useState<TaskStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = React.useState<TaskPriority | "all">("all");
  const [categoryManagerOpen, setCategoryManagerOpen] = React.useState(false);
  const [view, setView] = React.useState<TaskView>("lanes");
  const [openTaskId, setOpenTaskId] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const today = localDateString();

  React.useEffect(() => {
    if (!activeSpaceId) return;
    const stored = window.localStorage.getItem(`tempo-tasks-view:${activeSpaceId}`);
    if (stored && VIEWS.includes(stored as TaskView)) setView(stored as TaskView);
  }, [activeSpaceId]);

  function changeView(next: TaskView) {
    setView(next);
    if (activeSpaceId) window.localStorage.setItem(`tempo-tasks-view:${activeSpaceId}`, next);
  }

  React.useEffect(() => {
    if (
      categoryFilter !== "all" &&
      !categories.some((item) => item.key === categoryFilter)
    ) {
      setCategoryFilter("all");
    }
  }, [categories, categoryFilter]);

  React.useEffect(() => {
    if (!editTaskId || isLoading) return;
    setOpenTaskId(editTaskId);
  }, [editTaskId, isLoading]);

  const filtered = React.useMemo(() => {
    return tasks.filter((t) => {
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      return true;
    });
  }, [tasks, categoryFilter, statusFilter, priorityFilter]);

  const openTasks = React.useMemo(() => filtered.filter((t) => t.status !== "done"), [filtered]);
  const doneTasks = React.useMemo(() => filtered.filter((t) => t.status === "done"), [filtered]);

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
  const assigneeLabel = React.useCallback(
    (id: string | null | undefined) => (id ? assignees.find((a) => a.userId === id)?.label : undefined),
    [assignees]
  );

  const openTask = React.useMemo(() => tasks.find((t) => t.id === openTaskId) ?? null, [tasks, openTaskId]);

  async function handleComposerCreate(result: TaskComposerResult) {
    try {
      const task = await create.mutateAsync({
        title: result.title,
        category: result.category,
        status: "todo",
        due_date: result.dueDate,
        track_id: result.trackId,
        project_id: result.projectId,
        notes: result.notes,
        priority: result.priority,
        reminder_minutes: result.reminderMinutes,
        recurrence: result.recurrence,
        recurrence_until: result.recurrenceUntil,
      });
      let assignmentFailed = false;
      if (result.assigneeId) {
        try {
          await assign.mutateAsync({ id: task.id, userId: result.assigneeId });
        } catch {
          assignmentFailed = true;
        }
      }
      let stepsFailed = false;
      if (result.steps.length) {
        try {
          await Promise.all(result.steps.map((label, i) => createTaskStep(task.id, label, i)));
        } catch {
          stepsFailed = true;
        }
      }
      toast(
        assignmentFailed
          ? "Task added, but the assignee couldn’t be set."
          : stepsFailed
            ? "Task added, but the steps couldn’t be saved."
            : "Task added",
        assignmentFailed || stepsFailed ? undefined : "ok"
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t add task — try again.");
    }
  }

  async function patchTask(id: string, patch: TaskUpdate) {
    try {
      await update.mutateAsync({ id, patch });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t update task.");
    }
  }

  async function toggleDone(task: Task) {
    const goingDone = task.status !== "done";
    await patchTask(task.id, {
      status: goingDone ? "done" : "todo",
      completed_at: goingDone ? new Date().toISOString() : null,
    });
    if (goingDone && task.recurrence && task.due_date) {
      const next = nextDueDate(task.recurrence, task.due_date);
      if (!recurrenceExhausted(next, task.recurrence_until)) {
        try {
          await create.mutateAsync({
            title: task.title,
            category: task.category,
            status: "todo",
            due_date: next,
            notes: task.notes,
            project_id: task.project_id,
            track_id: task.track_id,
            priority: task.priority,
            reminder_minutes: task.reminder_minutes,
            recurrence: task.recurrence,
            recurrence_until: task.recurrence_until,
            recurrence_parent_id: task.recurrence_parent_id ?? task.id,
          });
        } catch {
          toast("Closed out, but the next occurrence couldn’t be created.");
        }
      }
    }
  }

  async function deleteTask(id: string) {
    try {
      await remove.mutateAsync(id);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t delete task.");
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tasks"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-chip border border-line bg-bg-2 p-0.5">
              {VIEWS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => changeView(v)}
                  className={
                    view === v
                      ? "rounded-chip border border-ice/40 bg-ice/10 px-3 py-1 text-xs text-ice"
                      : "rounded-chip px-3 py-1 text-xs text-text-lo hover:text-text-hi"
                  }
                >
                  {VIEW_LABELS[v]}
                </button>
              ))}
            </div>
            <Button type="button" variant="secondary" onClick={() => setCategoryManagerOpen(true)}>
              <Palette /> Categories
            </Button>
          </div>
        }
        subtitle="Actionable stuff outside a single track — pitching, social, admin."
      />

      <TaskComposer
        today={today}
        timezone={browserTimezone()}
        categories={categories}
        assignees={assignees.map((a) => ({ id: a.userId, name: a.label }))}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        tracks={tracks.map((t) => ({ id: t.id, name: t.title }))}
        onCreate={handleComposerCreate}
      />

      <FilterToolbar className="mb-4">
        <FilterGroup label="Type">
          <Chip size="sm" active={categoryFilter === "all"} onClick={() => setCategoryFilter("all")}>
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
        <FilterGroup label="Priority">
          <Chip size="sm" active={priorityFilter === "all"} onClick={() => setPriorityFilter("all")}>
            All
          </Chip>
          {([1, 2, 3] as TaskPriority[]).map((p) => (
            <Chip key={p} size="sm" active={priorityFilter === p} onClick={() => setPriorityFilter(p)}>
              {p === 1 ? "Low" : p === 2 ? "High" : "Urgent"}
            </Chip>
          ))}
        </FilterGroup>
        <FilterSep />
        <FilterGroup label="Show">
          <Chip size="sm" active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
            All
          </Chip>
          {TASK_STATUSES.map((s) => (
            <Chip
              key={s.value}
              size="sm"
              active={statusFilter === s.value}
              className={s.value === "done" && statusFilter === "done" ? "border-ok/40 bg-ok/10 text-ok" : undefined}
              onClick={() => setStatusFilter(s.value)}
            >
              {s.label === "Done" ? "Closed out" : s.label}
              {s.value === "done" && doneCount > 0 ? <span className="ml-1 font-data tabular-nums text-ok">{doneCount}</span> : null}
            </Chip>
          ))}
          {categoryFilter !== "all" || statusFilter !== "all" || priorityFilter !== "all" ? (
            <button
              type="button"
              onClick={() => {
                setCategoryFilter("all");
                setStatusFilter("all");
                setPriorityFilter("all");
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
          tasks={doneTasks}
          trackName={trackName}
          projectName={projectName}
          assigneeName={assigneeLabel}
          focusedId={editTaskId}
          onBack={() => setStatusFilter("all")}
          onToggle={(task) => toggleDone(task)}
          onDelete={(task) => deleteTask(task.id)}
          onOpen={(task) => setOpenTaskId(task.id)}
        />
      ) : view === "lanes" ? (
        <LanesView
          tasks={openTasks}
          today={today}
          editTaskId={editTaskId}
          trackName={trackName}
          projectName={projectName}
          assigneeLabel={assigneeLabel}
          onToggle={(task) => toggleDone(task)}
          onDelete={(task) => deleteTask(task.id)}
          onOpen={(task) => setOpenTaskId(task.id)}
          onReschedule={(id, dueDate) => patchTask(id, { due_date: dueDate })}
        />
      ) : view === "list" ? (
        <>
          <ListView
            tasks={openTasks}
            trackName={trackName}
            projectName={projectName}
            assigneeLabel={assigneeLabel}
            selected={selected}
            onToggleSelect={toggleSelect}
            onOpen={(task) => setOpenTaskId(task.id)}
            onToggleDone={(task) => toggleDone(task)}
          />
          <TaskBulkBar
            count={selected.size}
            onClear={() => setSelected(new Set())}
            onSetPriority={async (priority) => {
              await bulkUpdate.mutateAsync({ ids: Array.from(selected), patch: { priority } });
              setSelected(new Set());
            }}
            onClose={async () => {
              await bulkUpdate.mutateAsync({ ids: Array.from(selected), patch: { status: "done", completed_at: new Date().toISOString() } });
              setSelected(new Set());
            }}
            onDelete={async () => {
              await bulkRemove.mutateAsync(Array.from(selected));
              setSelected(new Set());
            }}
          />
        </>
      ) : (
        <TimelineView
          tasks={openTasks}
          today={today}
          projectName={projectName}
          assigneeLabel={assigneeLabel}
          onOpen={(task) => setOpenTaskId(task.id)}
        />
      )}

      {!isLoading && !filtered.length && (categoryFilter !== "all" || statusFilter !== "all" || priorityFilter !== "all") && !showingDone ? (
        <p className="well mt-4 px-4 py-6 text-center text-sm text-text-lo">No tasks match these filters.</p>
      ) : null}

      <TaskDrawer
        task={openTask}
        trackTitle={openTask ? trackName(openTask.track_id) : undefined}
        projectTitle={openTask ? projectName(openTask.project_id) : undefined}
        assignees={assignees.map((a) => ({ id: a.userId, name: a.label }))}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        tracks={tracks.map((t) => ({ id: t.id, name: t.title }))}
        onUpdate={patchTask}
        onAssign={async (id, userId) => {
          try {
            await assign.mutateAsync({ id, userId });
            toast(userId ? "Task assigned." : "Task unassigned.", "ok");
          } catch (err) {
            toast(err instanceof Error ? err.message : "Couldn’t change the assignee.");
          }
        }}
        onDelete={deleteTask}
        onClose={() => setOpenTaskId(null)}
      />

      <TaskCategoryManager
        open={categoryManagerOpen}
        onClose={() => setCategoryManagerOpen(false)}
        canManage={workspace.mode !== "entered" || canWrite(workspace.areas, "tasks")}
      />
    </div>
  );
}
