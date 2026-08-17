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
import { formatShortDate, localDateString } from "@/lib/format";
import { SpectraCoverArt } from "@/components/spectra/spectra-cover-art";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { PROJECT_TYPES } from "@/lib/constants";
import { useTaskCategoryPalette } from "@/components/tasks/task-category-provider";
import { taskCategoryChipStyle } from "@/lib/tasks/categories";
import { ReleaseWorkspace } from "@/components/projects/release-workspace";
import { ProjectHero } from "@/components/projects/project-hero";
import { ProjectTimeline, type ProjectTimelineEvent } from "@/components/projects/project-timeline";
import type { ProjectStatus, ProjectType } from "@/lib/types";

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

  const allTracksQuery = useTracks(activeSpaceId);
  const allTasksQuery = useTasks(activeSpaceId);
  const { update: updateTask, create: createTask } = useTaskMutations(activeSpaceId);

  const project = projectQuery.data;
  const tracks = tracksQuery.data ?? [];
  const tasks = projectTasksQuery.data ?? [];
  const allTracks = allTracksQuery.data ?? [];
  const allTasks = allTasksQuery.data ?? [];

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

  const tasksOpen = tasks.filter((t) => t.status !== "done").length;
  const tasksDone = tasks.filter((t) => t.status === "done").length;
  const totalUnits = tracks.length + tasks.length;
  const doneUnits = tasks.filter((t) => t.status === "done").length + 0;
  const progressPct = totalUnits > 0 ? Math.round((doneUnits / totalUnits) * 100) : null;

  const today = localDateString();
  const timelineEvents: ProjectTimelineEvent[] = [
    { key: "created", date: project.created_at.slice(0, 10), label: "Project created", status: "done" },
  ];
  if (releaseQuery.data?.release_date) {
    timelineEvents.push({
      key: "release-date",
      date: releaseQuery.data.release_date,
      label: "Release date",
      status: releaseQuery.data.release_date < today ? "done" : "upcoming",
    });
  }
  if (releaseQuery.data?.pitching_deadline) {
    timelineEvents.push({
      key: "pitching-deadline",
      date: releaseQuery.data.pitching_deadline,
      label: "Pitching deadline",
      status: releaseQuery.data.pitching_deadline < today ? "overdue" : "upcoming",
    });
  }
  for (const task of tasks) {
    if (!task.due_date) continue;
    timelineEvents.push({
      key: `task-${task.id}`,
      date: task.due_date,
      label: task.title,
      detail: "Task",
      status: task.status === "done" ? "done" : task.due_date < today ? "overdue" : "upcoming",
    });
  }
  if (project.deadline) {
    timelineEvents.push({
      key: "deadline",
      date: project.deadline,
      label: "Project deadline",
      status: project.deadline < today ? "overdue" : "upcoming",
    });
  }

  return (
    <div className="space-y-5">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-xs text-text-lo hover:text-ice"
      >
        <ArrowLeft className="size-3.5" />
        Projects
      </Link>

      <ProjectHero
        project={project}
        trackCount={tracks.length}
        tasksOpen={tasksOpen}
        tasksDone={tasksDone}
        progressPct={progressPct}
        onStatusChange={(status) => void saveMeta({ status })}
        onEditDetails={() => setEditOpen(true)}
      />

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

      <ProjectTimeline events={timelineEvents} />

      <section className="panel-quiet p-5">
        <SectionHeader label="Tracks" count={tracks.length} aside={<Link href="/tracks" className="text-xs text-ice hover:underline">New track</Link>} />
        <div className="mb-3 flex flex-wrap gap-2">
          <select
            className="h-8 min-w-[12rem] flex-1 rounded-input border border-line bg-bg-2 px-2 text-xs"
            value={attachTrackId}
            onChange={(e) => setAttachTrackId(e.target.value)}
          >
            <option value="">Attach a track…</option>
            {availableTracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            disabled={!attachTrackId}
            onClick={async () => {
              try {
                await attachTrack.mutateAsync({ trackId: attachTrackId, projectId: id });
                setAttachTrackId("");
              } catch (err) {
                toast(err instanceof Error ? err.message : "Couldn’t attach track.");
              }
            }}
          >
            Attach
          </Button>
        </div>
        {tracks.length === 0 ? (
          <QuietEmpty>No tracks attached yet.</QuietEmpty>
        ) : (
          <ul className="space-y-1.5">
            {tracks.map((t) => (
              <SpotlightCard
                as="li"
                key={t.id}
                radius={8}
                size={200}
                className="flex items-center gap-3 rounded-input border border-line bg-bg-2/40 px-2.5 py-2"
              >
                <div className="relative size-8 shrink-0 overflow-hidden rounded-input border border-line">
                  <SpectraCoverArt trackId={t.id} title={t.title} artworkUrl={t.artwork_url} animate={false} />
                </div>
                <Link href={`/track/${t.id}`} className="min-w-0 flex-1 truncate text-sm text-text-hi hover:text-ice">
                  {t.title}
                </Link>
                <button
                  type="button"
                  className="text-xs text-text-lo hover:text-warn"
                  onClick={async () => {
                    try {
                      await attachTrack.mutateAsync({ trackId: t.id, projectId: null });
                    } catch (err) {
                      toast(err instanceof Error ? err.message : "Couldn’t detach track.");
                    }
                  }}
                >
                  Detach
                </button>
              </SpotlightCard>
            ))}
          </ul>
        )}
      </section>

      <section className="panel-quiet p-5">
        <SectionHeader label="Tasks" count={tasks.length} aside={<Link href="/tasks" className="text-xs text-ice hover:underline">Open in Tasks</Link>} />
        <form
          className="mb-2 flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newTaskTitle.trim()) return;
            try {
              await createTask.mutateAsync({ title: newTaskTitle.trim(), project_id: id, space_id: activeSpaceId });
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
        <div className="mb-3 flex flex-wrap gap-2">
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
          <ul className="space-y-1.5">
            {tasks.map((t) => {
              const category = categories.find((item) => item.key === t.category);
              const cat = category?.label ?? t.category;
              return (
                <li key={t.id} className="flex items-center gap-3 rounded-input border border-line bg-bg-2/40 px-2.5 py-2">
                  <Link href={`/tasks?edit=${t.id}`} className="min-w-0 flex-1 truncate text-sm text-text-hi hover:text-ice">
                    {t.title}
                  </Link>
                  <span
                    className="rounded-chip border border-line px-2 py-0.5 font-mono text-[11px] text-text-lo"
                    style={taskCategoryChipStyle(category)}
                  >
                    {cat}
                    {t.due_date ? ` · ${formatShortDate(t.due_date + "T12:00:00")}` : ""}
                  </span>
                  <button
                    type="button"
                    className="text-xs text-text-lo hover:text-warn"
                    onClick={async () => {
                      try {
                        await attachTask.mutateAsync({ taskId: t.id, projectId: null });
                      } catch (err) {
                        toast(err instanceof Error ? err.message : "Couldn’t detach task.");
                      }
                    }}
                  >
                    Detach
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

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
