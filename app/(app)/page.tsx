"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { EmptyShaderPanel } from "@/components/shader-empty";
import { FlareLine } from "@/components/flare-line";
import { LfWindow } from "@/components/lf-windows";
import { SpectraCoverArt } from "@/components/spectra/spectra-cover-art";
import { ActiveSessionBanner } from "@/components/track/active-session-banner";
import { StartFocusDialog } from "@/components/track/start-focus-dialog";
import { TrackFormModal } from "@/components/tracks/track-form-modal";
import { useActiveArtist } from "@/components/active-artist-provider";
import { useActiveSpace } from "@/components/active-space-provider";
import { ArtistBanner } from "@/components/artists/artist-banner";
import { SignedImage } from "@/components/ui/signed-image";
import { useStages } from "@/hooks/use-stages";
import { useWeeklyElapsed } from "@/hooks/use-sessions";
import { useTaskMutations, useTasks } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { useTrackMutations, useTracks } from "@/hooks/use-tracks";
import { createSession, countSessionsThisWeek } from "@/lib/api/sessions";
import { countTasksDueThisWeek } from "@/lib/api/tasks";
import { createClient } from "@/lib/supabase/client";
import {
  addDays,
  formatDuration,
  formatShortDate,
  localDateString,
  startOfLocalDay,
} from "@/lib/format";
import { TASK_CATEGORIES } from "@/lib/constants";
import type { ProjectWithStats, Task, Track, TrackInsert } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  deriveAttentionSignals,
  sortTracksByAttention,
} from "@/lib/attention/signals";
import { useQuery } from "@tanstack/react-query";
import { SlitDivider } from "@/components/ui/slit";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { TrackCoverSlider } from "@/components/today/track-cover-slider";
import { ActivationGuideModule } from "@/components/today/activation-guide-module";
import { PulseModule } from "@/components/today/pulse-module";
import { useCurrentUser } from "@/hooks/use-current-user";

function greetingForHour(h: number): string {
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function TodayPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { activeSpaceId, activeSpace } = useActiveSpace();
  const { activeArtist } = useActiveArtist();
  const currentUser = useCurrentUser();
  const tasksFocused = activeSpace?.focus === "tasks";
  const tracksQuery = useTracks(activeSpaceId);
  const stagesQuery = useStages(activeSpaceId);
  const tasksQuery = useTasks(activeSpaceId);
  const projectsQuery = useProjects(activeSpaceId);
  const { create: createTrack } = useTrackMutations(activeSpaceId);
  const { create: createTask, update: updateTask } =
    useTaskMutations(activeSpaceId);

  const [trackModalOpen, setTrackModalOpen] = React.useState(false);
  const [taskOpen, setTaskOpen] = React.useState(false);
  const [taskTitle, setTaskTitle] = React.useState("");
  const [sessionOpen, setSessionOpen] = React.useState(false);
  const [sessionNote, setSessionNote] = React.useState("");
  const [sessionTrackId, setSessionTrackId] = React.useState("");
  const [focusPickerOpen, setFocusPickerOpen] = React.useState(false);
  const [focusPickTrackId, setFocusPickTrackId] = React.useState("");
  const [focusTrackId, setFocusTrackId] = React.useState<string | null>(null);
  const weeklyQuery = useWeeklyElapsed();

  const statsQuery = useQuery({
    queryKey: ["today-stats", activeSpaceId],
    queryFn: async () => {
      const [due, sessions] = await Promise.all([
        countTasksDueThisWeek(activeSpaceId),
        countSessionsThisWeek(),
      ]);
      return { due, sessions };
    },
    enabled: !!activeSpaceId,
  });

  const tracks = tracksQuery.data ?? [];
  const stages = stagesQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const projects = projectsQuery.data ?? [];
  const today = localDateString();
  const weekEnd = localDateString(addDays(startOfLocalDay(), 7));

  const activeTracks = tracks.filter((t) => t.momentum === "active");
  const prioritized = sortTracksByAttention(
    activeTracks.map((track) => ({ track }))
  );
  const waiting = prioritized.filter((x) =>
    deriveAttentionSignals(x).some((s) => s.id === "waiting" || s.id === "blocked")
  );
  const review = prioritized.filter((x) =>
    deriveAttentionSignals(x).some(
      (s) => s.id === "unresolved-feedback" || s.id === "approval-needed"
    )
  );
  const tasksDue = tasks
    .filter((t) => t.status !== "done" && t.due_date && t.due_date < weekEnd)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));
  const openTasks = tasks.filter((t) => t.status !== "done");
  const activeProjects = projects.filter((p) => p.status === "active");

  const now = new Date();
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const empty = tasksFocused
    ? !tasksQuery.isLoading && openTasks.length === 0 && projects.length === 0
    : !tracksQuery.isLoading && activeTracks.length === 0 && tasksDue.length === 0;

  async function handleCreateTrack(input: TrackInsert) {
    const track = await createTrack.mutateAsync(input);
    setTrackModalOpen(false);
    router.push(`/track/${track.id}`);
  }

  const focusTrack = tracks.find((t) => t.id === focusTrackId) ?? null;
  const weekly = weeklyQuery.data;
  const weeklyLabel = weekly
    ? weekly.totalSec > 0
      ? `${formatHoursMinutes(weekly.totalSec)} of focus time this week across ${weekly.sessionCount} session${weekly.sessionCount === 1 ? "" : "s"}`
      : "No focus sessions logged yet this week"
    : null;

  return (
    <div className="space-y-5">
      <ActiveSessionBanner />

      {/* Today hero — one tall surface carrying greeting, stats and actions.
          Scrim clears toward the right so the lightfield is actually visible. */}
      <LfWindow data-tour="today" className="relative overflow-hidden rounded-panel border border-line shadow-e3">
        <div className="absolute inset-0">
          <div className="scrim-reveal absolute inset-0" aria-hidden />
          {activeArtist ? (
            <ArtistBanner
              artist={activeArtist}
              fadeRight
              className="absolute inset-0"
            />
          ) : null}
        </div>
        {activeArtist?.logo_url ? (
          <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] flex w-[min(48%,24rem)] items-end justify-end p-2 sm:p-3">
            <SignedImage
              path={activeArtist.logo_url}
              alt={activeArtist.name}
              className="h-auto max-h-[min(70%,11rem)] w-auto max-w-full object-contain sm:max-h-[13rem]"
            />
          </div>
        ) : null}
        <div className="relative z-[1] flex flex-col gap-6 px-6 py-7 sm:px-8 sm:py-9">
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-text-hi sm:text-[40px] sm:leading-[1.05]">
              {greetingForHour(now.getHours())}
            </h1>
            <p className="mt-1.5 text-sm text-text-lo">{dateLabel}</p>
          </div>

          {tasksFocused ? (
            <div className="flex flex-wrap items-start gap-x-10 gap-y-5">
              <Stat value={statsQuery.data?.due} label="Due" />
              <Stat value={openTasks.length} label="Open" tone="amber" />
              <Stat value={activeProjects.length} label="Projects" />
            </div>
          ) : (
            <div className="flex flex-wrap items-start gap-x-10 gap-y-5">
              <Stat value={activeTracks.length} label="Active" tone="amber" />
              <Stat value={statsQuery.data?.due} label="Due" />
              <Stat value={statsQuery.data?.sessions} label="Sessions" />
            </div>
          )}

          {!tasksFocused && weeklyLabel ? (
            <p className="-mt-1 text-xs text-text-lo">{weeklyLabel}</p>
          ) : null}

          <div
            className={cn(
              activeArtist?.logo_url && "pr-[min(50%,280px)] sm:pr-[360px]"
            )}
          >
            <FlareLine className="mb-4 max-w-[420px] opacity-60" />
            <div data-tour="today-actions" className="flex flex-wrap gap-2">
              {tasksFocused ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setTaskOpen(true)}
                  >
                    <Plus className="size-3.5" />
                    Task
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => router.push("/projects")}
                  >
                    <Plus className="size-3.5" />
                    Project
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setTrackModalOpen(true)}
                  >
                    <Plus className="size-3.5" />
                    Track
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setTaskOpen(true)}
                  >
                    <Plus className="size-3.5" />
                    Task
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSessionTrackId(activeTracks[0]?.id ?? tracks[0]?.id ?? "");
                      setSessionOpen(true);
                    }}
                  >
                    Log session
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setFocusPickTrackId(
                        activeTracks[0]?.id ?? tracks[0]?.id ?? ""
                      );
                      setFocusPickerOpen(true);
                    }}
                  >
                    Start focus
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </LfWindow>

      {!empty && !tasksFocused && activeArtist && currentUser ? (
        <>
          <ActivationGuideModule
            spaceId={activeSpaceId ?? ""}
            artistId={activeArtist.id}
            ownerId={currentUser.id}
            isExistingMember={activeArtist.origin_status === "legacy_complete"}
          />
          <PulseModule />
        </>
      ) : null}

      {empty ? (
        <EmptyShaderPanel
          title="Today is clear"
          copy={
            tasksFocused
              ? "Add a task or a project — this space doesn't use tracks."
              : "Add a track, a task, or log a session — or bring your existing catalog in and TEMPO will organise it with you."
          }
          action={
            tasksFocused ? (
              <Button type="button" onClick={() => setTaskOpen(true)}>
                Add a task
              </Button>
            ) : (
              <Button asChild>
                <Link href="/import">Bring your music in</Link>
              </Button>
            )
          }
        />
      ) : tasksFocused ? (
        <TasksFocusPanels
          tasks={tasks}
          projects={projects}
          today={today}
          tasksLoading={tasksQuery.isLoading}
          projectsLoading={projectsQuery.isLoading}
          onToggleTask={async (task) => {
            try {
              await updateTask.mutateAsync({
                id: task.id,
                patch: { status: task.status === "done" ? "todo" : "done" },
              });
            } catch (err) {
              toast(err instanceof Error ? err.message : "Couldn’t update task.");
            }
          }}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          {/* Primary: what the musician should act on. */}
          <section className="panel p-5 lg:col-span-3">
            <SectionHeader label="Needs attention" count={prioritized.length} />
            {tracksQuery.isLoading ? (
              <div className="h-20 animate-pulse rounded-card bg-bg-2" />
            ) : prioritized.length === 0 ? (
              <QuietEmpty>
                No active tracks in {activeSpace?.name ?? "this space"}. Mark
                momentum Active on a track to see it here.
              </QuietEmpty>
            ) : (
              <ul className="space-y-2">
                {prioritized.map(({ track }) => {
                  const signals = deriveAttentionSignals({ track });
                  const top = signals[0];
                  return (
                    <InMotionRow
                      key={track.id}
                      track={track}
                      stageName={
                        stages.find((s) => s.id === track.stage_id)?.name
                      }
                      reason={top?.explanation}
                      actionHref={
                        top?.id === "unresolved-feedback"
                          ? `/track/${track.id}?panel=comments`
                          : `/track/${track.id}`
                      }
                      actionLabel={
                        top?.id === "unresolved-feedback"
                          ? "Open comments"
                          : top?.id === "no-next-move"
                            ? "Set next move"
                            : "Open"
                      }
                    />
                  );
                })}
              </ul>
            )}
            {waiting.length > 0 || review.length > 0 ? (
              <>
                <SlitDivider className="mt-4" />
                <div className="flex flex-wrap gap-x-4 gap-y-1 pt-3">
                {waiting.length > 0 ? (
                  <span className="label-mono">
                    Waiting / blocked{" "}
                    <span className="text-amber">{waiting.length}</span>
                  </span>
                ) : null}
                {review.length > 0 ? (
                  <span className="label-mono">
                    Review <span className="text-amber">{review.length}</span>
                  </span>
                ) : null}
                </div>
              </>
            ) : null}
          </section>

          {/* Secondary: quieter surface so it doesn't compete. */}
          <section className="panel-quiet p-5 lg:col-span-2">
            <SectionHeader label="Tasks due" count={tasksDue.length} />
            {tasksQuery.isLoading ? (
              <div className="h-20 animate-pulse rounded-card bg-bg-2" />
            ) : tasksDue.length === 0 ? (
              <QuietEmpty>Nothing due this week.</QuietEmpty>
            ) : (
              <ul className="space-y-1">
                {tasksDue.map((task) => (
                  <TodayTaskRow
                    key={task.id}
                    task={task}
                    today={today}
                    onToggle={async () => {
                      try {
                        await updateTask.mutateAsync({
                          id: task.id,
                          patch: {
                            status: task.status === "done" ? "todo" : "done",
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
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {!tasksFocused && tracks.length > 0 ? (
        <TrackCoverSlider tracks={tracks} className="pt-2" />
      ) : null}

      {activeSpaceId ? (
        <TrackFormModal
          open={trackModalOpen}
          onOpenChange={setTrackModalOpen}
          spaceId={activeSpaceId}
          stages={stages}
          onSubmit={handleCreateTrack}
        />
      ) : null}

      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent
          title="Quick task"
          onClose={() => setTaskOpen(false)}
        >
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!taskTitle.trim()) return;
              try {
                await createTask.mutateAsync({
                  title: taskTitle,
                  due_date: today,
                });
                setTaskTitle("");
                setTaskOpen(false);
                toast("Task added", "ok");
              } catch (err) {
                toast(
                  err instanceof Error
                    ? err.message
                    : "Couldn’t add task."
                );
              }
            }}
          >
            <input
              className="h-10 w-full rounded-input border border-line bg-bg-2 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="What needs doing?"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setTaskOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!taskTitle.trim()}>
                Add
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={sessionOpen} onOpenChange={setSessionOpen}>
        <DialogContent
          title="Log a session"
          description="Quick note from Today — pick a track."
          onClose={() => setSessionOpen(false)}
        >
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!sessionTrackId || !sessionNote.trim()) return;
              try {
                await createSession({
                  trackId: sessionTrackId,
                  note: sessionNote,
                });
                setSessionNote("");
                setSessionOpen(false);
                toast("Session logged", "ok");
                statsQuery.refetch();
              } catch (err) {
                toast(
                  err instanceof Error
                    ? err.message
                    : "Couldn’t log session."
                );
              }
            }}
          >
            <select
              className="h-9 w-full rounded-input border border-line bg-bg-2 px-2 text-sm"
              value={sessionTrackId}
              onChange={(e) => setSessionTrackId(e.target.value)}
              required
            >
              <option value="">Pick a track…</option>
              {tracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            <Textarea
              value={sessionNote}
              onChange={(e) => setSessionNote(e.target.value)}
              placeholder="Worked on drums, rewrote drop…"
              rows={3}
              required
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSessionOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!sessionTrackId || !sessionNote.trim()}
              >
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={focusPickerOpen} onOpenChange={setFocusPickerOpen}>
        <DialogContent
          title="Start a focus session"
          description="Pick a track to focus on."
          onClose={() => setFocusPickerOpen(false)}
        >
          <div className="space-y-3">
            <select
              className="h-9 w-full rounded-input border border-line bg-bg-2 px-2 text-sm"
              value={focusPickTrackId}
              onChange={(e) => setFocusPickTrackId(e.target.value)}
            >
              <option value="">Pick a track…</option>
              {tracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setFocusPickerOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!focusPickTrackId}
                onClick={() => {
                  setFocusTrackId(focusPickTrackId);
                  setFocusPickerOpen(false);
                }}
              >
                Continue
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {focusTrack ? (
        <StartFocusDialog
          open={!!focusTrackId}
          onOpenChange={(open) => {
            if (!open) setFocusTrackId(null);
          }}
          trackId={focusTrack.id}
          trackTitle={focusTrack.title}
        />
      ) : null}
    </div>
  );
}

function formatHoursMinutes(totalSec: number): string {
  const totalMin = Math.round(totalSec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Big glanceable numeral + label. Mono per spec — all data is mono. */
function Stat({
  value,
  label,
  tone,
}: {
  value: number | undefined;
  label: string;
  tone?: "amber";
}) {
  return (
    <div>
      <p
        className={cn(
          "stat-value",
          // Zeros and pending values recede; only real counts earn full weight.
          value === undefined || value === 0
            ? "text-text-lo/50"
            : tone === "amber"
              ? "text-amber"
              : "text-text-hi"
        )}
      >
        {value ?? "—"}
      </p>
      <p className="label-mono mt-2">{label}</p>
    </div>
  );
}

function SectionHeader({ label, count }: { label: string; count?: number }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <h2 className="label-mono">{label}</h2>
      {count !== undefined && count > 0 ? (
        <span className="font-mono text-[11px] tabular-nums text-text-lo/70">
          {count}
        </span>
      ) : null}
      {/* The rule running out from a section label is a slit onto the field —
          a hint of the light rather than a flat grey line. */}
      <LfWindow className="h-px flex-1 opacity-80" aria-hidden />
    </div>
  );
}

function QuietEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="well px-4 py-8 text-center">
      <p className="mx-auto max-w-[38ch] text-sm text-text-lo">{children}</p>
    </div>
  );
}

/**
 * The lower section for a tasks-focused space — open tasks in place of
 * track "Needs attention", project progress in place of the cover slider.
 */
function TasksFocusPanels({
  tasks,
  projects,
  today,
  tasksLoading,
  projectsLoading,
  onToggleTask,
}: {
  tasks: Task[];
  projects: ProjectWithStats[];
  today: string;
  tasksLoading: boolean;
  projectsLoading: boolean;
  onToggleTask: (task: Task) => Promise<void>;
}) {
  const openTasks = [...tasks]
    .filter((t) => t.status !== "done")
    .sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date < b.due_date ? -1 : 1;
    });

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <section className="panel p-5 lg:col-span-3">
        <SectionHeader label="Open tasks" count={openTasks.length} />
        {tasksLoading ? (
          <div className="h-20 animate-pulse rounded-card bg-bg-2" />
        ) : openTasks.length === 0 ? (
          <QuietEmpty>Nothing open. Add a task to get started.</QuietEmpty>
        ) : (
          <ul className="space-y-1">
            {openTasks.map((task) => (
              <TodayTaskRow
                key={task.id}
                task={task}
                today={today}
                onToggle={() => onToggleTask(task)}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="panel-quiet p-5 lg:col-span-2">
        <SectionHeader label="Projects" count={projects.length} />
        {projectsLoading ? (
          <div className="h-20 animate-pulse rounded-card bg-bg-2" />
        ) : projects.length === 0 ? (
          <QuietEmpty>No projects yet in this space.</QuietEmpty>
        ) : (
          <ul className="space-y-2">
            {projects.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.id}`}
                  className="well lift flex items-center justify-between gap-2 rounded-input px-3 py-2.5"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-text-hi">
                    {project.name}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-text-lo">
                    {project.checklist_pct != null
                      ? `${project.checklist_pct}%`
                      : `${project.task_count} task${project.task_count === 1 ? "" : "s"}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TodayTaskRow({
  task,
  today,
  onToggle,
}: {
  task: Task;
  today: string;
  onToggle: () => Promise<void>;
}) {
  const overdue = !!task.due_date && task.due_date < today;
  const cat =
    TASK_CATEGORIES.find((c) => c.value === task.category)?.label ??
    task.category;
  return (
    <li className="lift flex items-start gap-2.5 rounded-input border border-transparent px-2 py-2">
      <input
        type="checkbox"
        checked={task.status === "done"}
        onChange={() => void onToggle()}
        className="mt-1 size-4 accent-[var(--ice)]"
      />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm", overdue ? "text-warn" : "text-text-hi")}>
          {task.title}
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <span className="rounded-chip bg-bg-2 px-2 py-0.5 text-[10px] text-text-lo">
            {cat}
          </span>
          {task.due_date ? (
            <span
              className={cn(
                "font-mono text-[10px]",
                overdue ? "text-warn" : "text-text-lo"
              )}
            >
              {task.due_date}
            </span>
          ) : null}
          {task.track_id ? (
            <Link
              href={`/track/${task.track_id}`}
              className="text-[10px] text-ice hover:underline"
            >
              Track
            </Link>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function InMotionRow({
  track,
  stageName,
  reason,
  actionHref,
  actionLabel,
}: {
  track: Track;
  stageName?: string;
  reason?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  const lastSessionQuery = useQuery({
    queryKey: ["last-session", track.id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("sessions")
        .select("logged_at")
        .eq("track_id", track.id)
        .order("logged_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.logged_at ?? null;
    },
  });

  return (
    <SpotlightCard
      as="li"
      tone={track.blocked_reason?.trim() ? "warn" : "ramp"}
      radius={12}
      size={220}
      className="well lift px-3 py-2.5"
    >
      <div className="relative flex items-center gap-3">
        <Link
          href={actionHref ?? `/track/${track.id}`}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <div
            className="relative size-11 shrink-0 overflow-hidden rounded-input border border-line shadow-e1"
          >
            <SpectraCoverArt
              trackId={track.id}
              title={track.title}
              artworkUrl={track.artwork_url}
              animate={false}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-text-hi">{track.title}</p>
            <p className="font-mono text-[10px] text-text-lo">
              {stageName ?? "No stage"}
              {" · "}
              {lastSessionQuery.data
                ? `Last session ${formatShortDate(lastSessionQuery.data)}`
                : "No sessions yet"}
            </p>
            {reason ? (
              <p className="mt-0.5 text-[11px] text-amber">{reason}</p>
            ) : null}
          </div>
        </Link>
        {actionLabel ? (
          <Link
            href={actionHref ?? `/track/${track.id}`}
            className="shrink-0 text-[11px] text-ice hover:underline"
          >
            {actionLabel}
          </Link>
        ) : null}
      </div>
    </SpotlightCard>
  );
}
