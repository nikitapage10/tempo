"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SectionHeader, QuietEmpty } from "@/components/ui/section-header";
import { useToast } from "@/components/ui/toast";
import { useActiveSpace } from "@/components/active-space-provider";
import {
  useProject,
  useProjectMutations,
  useProjectTasks,
  useProjectTracks,
} from "@/hooks/use-projects";
import { useTaskMutations, useTasks } from "@/hooks/use-tasks";
import { useTracks } from "@/hooks/use-tracks";
import { useReleaseDetails } from "@/hooks/use-release";
import { localDateString } from "@/lib/format";
import { nextDueDate, recurrenceExhausted } from "@/lib/tasks/recurrence";
import { PROJECT_TYPES } from "@/lib/constants";
import { useTaskCategoryPalette } from "@/components/tasks/task-category-provider";
import { ReleaseWorkspace } from "@/components/projects/release-workspace";
import { ProjectHero } from "@/components/projects/project-hero";
import { ProjectTracksPanel } from "@/components/projects/project-tracks-panel";
import { ProjectTimeline, type ProjectTimelineEvent } from "@/components/projects/project-timeline";
import {
  ProjectMiniCalendar,
  type MiniCalendarItem,
} from "@/components/projects/project-mini-calendar";
import { ProjectTaskList } from "@/components/projects/project-task-list";
import { useChecklistForTracks } from "@/hooks/use-checklist";
import { useStages } from "@/hooks/use-stages";
import {
  checklistRollupByTrack,
  pickNextUp,
  projectProgressPct,
  type ProjectMilestone,
} from "@/lib/projects/health";
import type { ProjectStatus, ProjectType, Task } from "@/lib/types";

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const calendarEdit = searchParams.get("edit");
  const { toast } = useToast();
  const { activeSpaceId } = useActiveSpace();
  const { categories } = useTaskCategoryPalette();

  const projectQuery = useProject(id);
  const tracksQuery = useProjectTracks(id);
  const projectTasksQuery = useProjectTasks(id);
  const { update, remove, attachTrack, attachTask } = useProjectMutations();
  const releaseQuery = useReleaseDetails(id);
  const stagesQuery = useStages(activeSpaceId);

  const allTracksQuery = useTracks(activeSpaceId);
  const allTasksQuery = useTasks(activeSpaceId);
  const { update: updateTask, create: createTask } = useTaskMutations(activeSpaceId);

  const project = projectQuery.data;
  const tracks = tracksQuery.data ?? [];
  const tasks = projectTasksQuery.data ?? [];
  const allTracks = allTracksQuery.data ?? [];
  const allTasks = allTasksQuery.data ?? [];
  const stages = stagesQuery.data ?? [];
  const trackIds = React.useMemo(() => tracks.map((t) => t.id), [tracks]);
  const checklistQuery = useChecklistForTracks(trackIds);
  const rollupByTrack = React.useMemo(
    () => checklistRollupByTrack(checklistQuery.data ?? []),
    [checklistQuery.data]
  );

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [deadline, setDeadline] = React.useState("");
  const [projectType, setProjectType] = React.useState<ProjectType>("general");
  const [attachTrackId, setAttachTrackId] = React.useState("");
  const [attachTaskId, setAttachTaskId] = React.useState("");
  const [newTaskTitle, setNewTaskTitle] = React.useState("");
  const [editOpen, setEditOpen] = React.useState(false);

  React.useEffect(() => {
    if (!project) return;
    setName(project.name);
    setDescription(project.description ?? "");
    setDeadline(project.deadline ?? "");
    setProjectType(project.project_type);
  }, [project]);

  React.useEffect(() => {
    if (!project || !calendarEdit) return;
    if (calendarEdit === "deadline") setEditOpen(true);
    const targetId =
      calendarEdit === "release-date"
        ? "release-date"
        : calendarEdit === "pitching-deadline"
          ? "pitching-deadline"
          : null;
    if (!targetId) return;
    const timer = window.setTimeout(() => {
      const target = document.getElementById(targetId);
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
      target?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [project, calendarEdit]);

  const availableTracks = allTracks.filter(
    (t) => t.project_id !== id && !tracks.some((x) => x.id === t.id)
  );
  const availableTasks = allTasks.filter(
    (t) => t.project_id !== id && !tasks.some((x) => x.id === t.id)
  );

  if (projectQuery.isLoading) {
    return <div className="h-48 animate-pulse rounded-card bg-bg-1" />;
  }

  if (!project) {
    return (
      <div className="rounded-card border border-line px-6 py-12 text-center">
        <p className="text-sm text-text-lo">Project not found.</p>
        <Button
          type="button"
          className="mt-4"
          variant="secondary"
          onClick={() => router.push("/projects")}
        >
          Back to projects
        </Button>
      </div>
    );
  }

  async function saveMeta(patch: Partial<{ name: string; description: string; deadline: string | null; project_type: ProjectType; status: ProjectStatus }> = {}) {
    try {
      await update.mutateAsync({
        id,
        patch: {
          name: name.trim() || project!.name,
          description,
          deadline: deadline || null,
          project_type: projectType,
          ...patch,
        },
      });
      toast("Project saved", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t save project.");
    }
  }

  async function toggleTaskDone(task: Task) {
    const goingDone = task.status !== "done";
    try {
      await updateTask.mutateAsync({
        id: task.id,
        patch: {
          status: goingDone ? "done" : "todo",
          completed_at: goingDone ? new Date().toISOString() : null,
        },
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t update task.");
      return;
    }
    if (!goingDone || !task.recurrence || !task.due_date) return;
    const next = nextDueDate(task.recurrence, task.due_date);
    if (recurrenceExhausted(next, task.recurrence_until)) return;
    try {
      await createTask.mutateAsync({
        title: task.title,
        category: task.category,
        status: "todo",
        due_date: next,
        notes: task.notes,
        project_id: task.project_id,
        track_id: task.track_id,
        space_id: task.space_id,
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

  const tasksOpen = tasks.filter((t) => t.status !== "done").length;
  const tasksDone = tasks.filter((t) => t.status === "done").length;
  const progressPct = projectProgressPct(tasks, rollupByTrack, trackIds);

  const today = localDateString();

  // Milestones feed the mini calendar and sidebar timeline.
  const milestones: ProjectMilestone[] = [
    { key: "created", date: project.created_at.slice(0, 10), label: "Project created", tone: "ok" },
  ];
  if (releaseQuery.data?.release_date) {
    milestones.push({
      key: "release-date",
      date: releaseQuery.data.release_date,
      label: "Release date",
      tone: releaseQuery.data.release_date < today ? "ok" : "ice",
    });
  }
  if (releaseQuery.data?.pitching_deadline) {
    milestones.push({
      key: "pitching-deadline",
      date: releaseQuery.data.pitching_deadline,
      label: "Pitching deadline",
      tone: releaseQuery.data.pitching_deadline < today ? "warn" : "amber",
    });
  }
  if (project.deadline) {
    milestones.push({
      key: "deadline",
      date: project.deadline,
      label: "Project deadline",
      tone: project.deadline < today ? "warn" : "amber",
    });
  }

  const timelineEvents: ProjectTimelineEvent[] = milestones.map((m) => ({
    key: m.key,
    date: m.date,
    label: m.label,
    status: m.tone === "ok" ? "done" : m.tone === "warn" ? "overdue" : "upcoming",
  }));

  const datedTasks = tasks.filter((t) => t.due_date);
  const calendarItems: MiniCalendarItem[] = [
    ...milestones.map((m) => ({
      key: `milestone-${m.key}`,
      date: m.date,
      label: m.label,
      color: m.tone === "warn" ? "var(--warn)" : m.tone === "amber" ? "var(--amber)" : "var(--ice)",
      done: m.tone === "ok",
    })),
    ...datedTasks.map((t) => ({
      key: `task-${t.id}`,
      date: t.due_date as string,
      label: t.title,
      color:
        t.status !== "done" && (t.due_date as string) < today
          ? "var(--warn)"
          : (categories.find((c) => c.key === t.category)?.color ?? "var(--ice)"),
      href: `/tasks?edit=${t.id}`,
      done: t.status === "done",
    })),
    ...tracks
      .filter((t) => t.next_action_due)
      .map((t) => ({
        key: `track-next-${t.id}`,
        date: t.next_action_due as string,
        label: t.next_action?.trim() ? `${t.title}: ${t.next_action.trim()}` : t.title,
        color:
          (t.next_action_due as string) < today ? "var(--warn)" : "var(--violet)",
        href: `/track/${t.id}`,
        done: false,
      })),
  ];

  const nextUp = pickNextUp(milestones, tasks, tracks, today);

  return (
    <div className="space-y-5">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-xs text-text-lo hover:text-ice"
      >
        <ArrowLeft className="size-3.5" />
        Projects
      </Link>

      <div className="rise-in">
        <ProjectHero
          project={project}
          trackCount={tracks.length}
          tasksOpen={tasksOpen}
          tasksDone={tasksDone}
          progressPct={progressPct}
          nextUp={nextUp}
          onStatusChange={(status) => void saveMeta({ status })}
          onEditDetails={() => setEditOpen(true)}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <section className="panel-quiet rise-in p-5" style={{ ["--rise-delay" as string]: "60ms" }}>
            <SectionHeader
              label="Tasks"
              count={tasks.length}
              aside={
                <Link href="/tasks" className="text-xs text-ice hover:underline">
                  Open in Tasks
                </Link>
              }
            />
            <form
              className="mb-2 flex flex-wrap gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newTaskTitle.trim()) return;
                try {
                  await createTask.mutateAsync({
                    title: newTaskTitle.trim(),
                    project_id: id,
                    space_id: activeSpaceId,
                  });
                  setNewTaskTitle("");
                } catch (err) {
                  toast(err instanceof Error ? err.message : "Couldn’t add task.");
                }
              }}
            >
              <input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="New task for this project…"
                className="h-8 min-w-[12rem] flex-1 rounded-input border border-line bg-bg-2 px-2 text-xs text-text-hi placeholder:text-text-lo"
              />
              <Button type="submit" size="sm" disabled={!newTaskTitle.trim() || createTask.isPending}>
                Add
              </Button>
            </form>
            <div className="mb-4 flex flex-wrap gap-2">
              <select
                className="h-8 min-w-[12rem] flex-1 rounded-input border border-line bg-bg-2 px-2 text-xs"
                value={attachTaskId}
                onChange={(e) => setAttachTaskId(e.target.value)}
              >
                <option value="">Attach an existing task…</option>
                {availableTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                disabled={!attachTaskId}
                onClick={async () => {
                  try {
                    await attachTask.mutateAsync({ taskId: attachTaskId, projectId: id });
                    setAttachTaskId("");
                  } catch (err) {
                    toast(err instanceof Error ? err.message : "Couldn’t attach task.");
                  }
                }}
              >
                Attach
              </Button>
            </div>
            {tasks.length === 0 ? (
              <QuietEmpty>No tasks attached yet.</QuietEmpty>
            ) : (
              <ProjectTaskList
                tasks={tasks}
                categories={categories}
                today={today}
                onToggle={(task) => void toggleTaskDone(task)}
                onDetach={async (task) => {
                  try {
                    await attachTask.mutateAsync({ taskId: task.id, projectId: null });
                  } catch (err) {
                    toast(err instanceof Error ? err.message : "Couldn’t detach task.");
                  }
                }}
              />
            )}
          </section>
        </div>

        <aside className="space-y-5">
          <section className="panel-quiet rise-in p-5" style={{ ["--rise-delay" as string]: "90ms" }}>
            <h2 className="label-mono mb-4">Calendar</h2>
            <ProjectMiniCalendar items={calendarItems} today={today} />
          </section>

          <div className="rise-in" style={{ ["--rise-delay" as string]: "120ms" }}>
            <ProjectTimeline events={timelineEvents} />
          </div>

          <div className="rise-in" style={{ ["--rise-delay" as string]: "150ms" }}>
            <ProjectTracksPanel
              tracks={tracks}
              stages={stages}
              rollupByTrack={rollupByTrack}
              today={today}
              availableTracks={availableTracks}
              attachTrackId={attachTrackId}
              onAttachTrackIdChange={setAttachTrackId}
              onAttach={() => {
                void (async () => {
                  try {
                    await attachTrack.mutateAsync({ trackId: attachTrackId, projectId: id });
                    setAttachTrackId("");
                  } catch (err) {
                    toast(err instanceof Error ? err.message : "Couldn’t attach track.");
                  }
                })();
              }}
              onDetach={(trackId) => {
                void (async () => {
                  try {
                    await attachTrack.mutateAsync({ trackId, projectId: null });
                  } catch (err) {
                    toast(err instanceof Error ? err.message : "Couldn’t detach track.");
                  }
                })();
              }}
              attachPending={attachTrack.isPending}
            />
          </div>
        </aside>
      </div>

      {project.project_type !== "general" ? (
        <div
          id="release-workspace"
          className={
            calendarEdit === "release-date" || calendarEdit === "pitching-deadline"
              ? "rounded-panel ring-2 ring-ice/60"
              : undefined
          }
        >
          <ReleaseWorkspace
            project={project}
            tracks={tracks}
            tasks={tasks}
            onUpdateTask={async (taskId, patch) => {
              await updateTask.mutateAsync({ id: taskId, patch });
            }}
          />
        </div>
      ) : null}

      <div className="flex justify-end">
        <DeleteProjectButton
          onDelete={async () => {
            await remove.mutateAsync(id);
            router.push("/projects");
          }}
        />
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent title="Edit details" onClose={() => setEditOpen(false)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="p-name">Name</Label>
              <Input
                id="p-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => void saveMeta()}
                className="mt-1 font-display text-lg font-semibold"
              />
            </div>
            <div>
              <Label htmlFor="p-type">Type</Label>
              <select
                id="p-type"
                value={projectType}
                onChange={(e) => {
                  const next = e.target.value as ProjectType;
                  setProjectType(next);
                  void saveMeta({ project_type: next });
                }}
                className="mt-1 flex h-9 w-full rounded-input border border-line bg-bg-2 px-3 text-sm text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
              >
                {PROJECT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="p-deadline">Deadline</Label>
              <Input
                id="p-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                onBlur={() => void saveMeta()}
                className="mt-1"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="p-desc">Description</Label>
              <Textarea
                id="p-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => void saveMeta()}
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DeleteProjectButton({ onDelete }: { onDelete: () => Promise<void> }) {
  const [confirm, setConfirm] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  if (!confirm) {
    return (
      <button type="button" className="text-xs text-text-lo hover:text-warn" onClick={() => setConfirm(true)}>
        Delete project
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-warn">Delete this project?</span>
      <button
        type="button"
        disabled={busy}
        className="text-warn hover:underline"
        onClick={async () => {
          setBusy(true);
          try {
            await onDelete();
          } finally {
            setBusy(false);
          }
        }}
      >
        Yes
      </button>
      <button type="button" className="text-text-lo" onClick={() => setConfirm(false)}>
        Cancel
      </button>
    </div>
  );
}
