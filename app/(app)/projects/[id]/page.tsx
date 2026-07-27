"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { formatShortDate } from "@/lib/format";
import { gradientFromTrackId } from "@/lib/track-style";
import { SignedImage } from "@/components/ui/signed-image";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { PROJECT_TYPES, TASK_CATEGORIES } from "@/lib/constants";
import { ReleaseWorkspace } from "@/components/projects/release-workspace";
import type { ProjectType } from "@/lib/types";

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { toast } = useToast();
  const { activeSpaceId } = useActiveSpace();

  const projectQuery = useProject(id);
  const tracksQuery = useProjectTracks(id);
  const projectTasksQuery = useProjectTasks(id);
  const { update, remove, attachTrack, attachTask } = useProjectMutations();

  const allTracksQuery = useTracks(activeSpaceId);
  const allTasksQuery = useTasks();
  const { update: updateTask } = useTaskMutations();

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

  React.useEffect(() => {
    if (!project) return;
    setName(project.name);
    setDescription(project.description ?? "");
    setDeadline(project.deadline ?? "");
    setProjectType(project.project_type);
  }, [project]);

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

  async function saveMeta(patch: Partial<{ name: string; description: string; deadline: string | null; project_type: ProjectType }> = {}) {
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
      toast(
        err instanceof Error ? err.message : "Couldn’t save project."
      );
    }
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

      <div className="rounded-card border border-line bg-bg-1 p-4 sm:p-5">
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
      </div>

      {project.project_type !== "general" ? (
        <ReleaseWorkspace
          project={project}
          tracks={tracks}
          tasks={tasks}
          onUpdateTask={async (taskId, patch) => {
            await updateTask.mutateAsync({ id: taskId, patch });
          }}
        />
      ) : null}

      <section className="rounded-card border border-line bg-bg-1 p-4">
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo">
          Tracks
          <span className="ml-2 text-text-lo/70">{tracks.length}</span>
        </h2>
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
                await attachTrack.mutateAsync({
                  trackId: attachTrackId,
                  projectId: id,
                });
                setAttachTrackId("");
              } catch (err) {
                toast(
                  err instanceof Error
                    ? err.message
                    : "Couldn’t attach track."
                );
              }
            }}
          >
            Attach
          </Button>
        </div>
        <ul className="space-y-1.5">
          {tracks.length === 0 ? (
            <li className="py-3 text-center text-sm text-text-lo">
              No tracks attached yet.
            </li>
          ) : (
            tracks.map((t) => (
              <SpotlightCard
                as="li"
                key={t.id}
                radius={8}
                size={200}
                className="flex items-center gap-3 rounded-input border border-line bg-bg-2/40 px-2.5 py-2"
              >
                <div
                  className="relative size-8 shrink-0 overflow-hidden rounded-input border border-line"
                  style={{ background: gradientFromTrackId(t.id) }}
                >
                  <SignedImage
                    path={t.artwork_url}
                    className="absolute inset-0 size-full"
                  />
                </div>
                <Link
                  href={`/track/${t.id}`}
                  className="min-w-0 flex-1 truncate text-sm text-text-hi hover:text-ice"
                >
                  {t.title}
                </Link>
                <button
                  type="button"
                  className="text-[11px] text-text-lo hover:text-warn"
                  onClick={async () => {
                    try {
                      await attachTrack.mutateAsync({
                        trackId: t.id,
                        projectId: null,
                      });
                    } catch (err) {
                      toast(
                        err instanceof Error
                          ? err.message
                          : "Couldn’t detach track."
                      );
                    }
                  }}
                >
                  Detach
                </button>
              </SpotlightCard>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-card border border-line bg-bg-1 p-4">
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo">
          Tasks
          <span className="ml-2 text-text-lo/70">{tasks.length}</span>
        </h2>
        <div className="mb-3 flex flex-wrap gap-2">
          <select
            className="h-8 min-w-[12rem] flex-1 rounded-input border border-line bg-bg-2 px-2 text-xs"
            value={attachTaskId}
            onChange={(e) => setAttachTaskId(e.target.value)}
          >
            <option value="">Attach a task…</option>
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
                await attachTask.mutateAsync({
                  taskId: attachTaskId,
                  projectId: id,
                });
                setAttachTaskId("");
              } catch (err) {
                toast(
                  err instanceof Error
                    ? err.message
                    : "Couldn’t attach task."
                );
              }
            }}
          >
            Attach
          </Button>
        </div>
        <ul className="space-y-1.5">
          {tasks.length === 0 ? (
            <li className="py-3 text-center text-sm text-text-lo">
              No tasks attached yet.
            </li>
          ) : (
            tasks.map((t) => {
              const cat =
                TASK_CATEGORIES.find((c) => c.value === t.category)?.label ??
                t.category;
              return (
                <li
                  key={t.id}
                  className="flex items-center gap-3 rounded-input border border-line bg-bg-2/40 px-2.5 py-2"
                >
                  <Link
                    href="/tasks"
                    className="min-w-0 flex-1 truncate text-sm text-text-hi hover:text-ice"
                  >
                    {t.title}
                  </Link>
                  <span className="font-mono text-[10px] text-text-lo">
                    {cat}
                    {t.due_date
                      ? ` · ${formatShortDate(t.due_date + "T12:00:00")}`
                      : ""}
                  </span>
                  <button
                    type="button"
                    className="text-[11px] text-text-lo hover:text-warn"
                    onClick={async () => {
                      try {
                        await attachTask.mutateAsync({
                          taskId: t.id,
                          projectId: null,
                        });
                      } catch (err) {
                        toast(
                          err instanceof Error
                            ? err.message
                            : "Couldn’t detach task."
                        );
                      }
                    }}
                  >
                    Detach
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </section>

      <div className="flex justify-end">
        <DeleteProjectButton
          onDelete={async () => {
            await remove.mutateAsync(id);
            router.push("/projects");
          }}
        />
      </div>
    </div>
  );
}

function DeleteProjectButton({
  onDelete,
}: {
  onDelete: () => Promise<void>;
}) {
  const [confirm, setConfirm] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  if (!confirm) {
    return (
      <button
        type="button"
        className="text-xs text-text-lo hover:text-warn"
        onClick={() => setConfirm(true)}
      >
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
      <button
        type="button"
        className="text-text-lo"
        onClick={() => setConfirm(false)}
      >
        Cancel
      </button>
    </div>
  );
}
