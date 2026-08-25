"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Inbox, ListMusic, Plus } from "lucide-react";
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
import { useTaskCategoryPalette } from "@/components/tasks/task-category-provider";
import { taskCategoryChipStyle } from "@/lib/tasks/categories";
import type { ProjectWithStats, Task, Track, TrackInsert } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  deriveAttentionSignals,
  sortTracksByAttention,
} from "@/lib/attention/signals";
import { useQuery } from "@tanstack/react-query";
import { ActivationGuideModule } from "@/components/today/activation-guide-module";
import { PulseModule } from "@/components/today/pulse-module";
import { ProTodayHub } from "@/components/today/pro-today-hub";
import { TrackCoverSlider } from "@/components/today/track-cover-slider";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useWorkspaceMode } from "@/hooks/use-workspace-mode";

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
  const { mode } = useWorkspaceMode();
  const isProHome = mode === "work";
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
  const featuredTrack = prioritized[0]?.track ?? null;
  const queuedAttention = prioritized.slice(1, 4);
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
  const overdueTasks = tasksDue.filter((task) => task.due_date! < today).slice(0, 3);
  const upcomingTasks = tasksDue
    .filter((task) => task.due_date! >= today)
    .slice(0, Math.max(0, 4 - overdueTasks.length));
  const openTasks = tasks.filter((t) => t.status !== "done");
  const activeProjects = projects.filter((p) => p.status === "active");

  const now = new Date();
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const empty =
    !isProHome &&
    (tasksFocused
      ? !tasksQuery.isLoading && openTasks.length === 0 && projects.length === 0
      : !tracksQuery.isLoading && activeTracks.length === 0 && tasksDue.length === 0);

  async function handleCreateTrack(input: TrackInsert) {
    const track = await createTrack.mutateAsync(input);
    setTrackModalOpen(false);
    router.push(`/track/${track.id}`);
  }

  async function handleToggleTodayTask(task: Task) {
    try {
      await updateTask.mutateAsync({
        id: task.id,
        patch: { status: task.status === "done" ? "todo" : "done" },
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t update task.");
    }
  }

  const focusTrack = tracks.find((t) => t.id === focusTrackId) ?? null;
  const weekly = weeklyQuery.data;
  const weeklyLabel = weekly
    ? weekly.totalSec > 0
      ? `${formatHoursMinutes(weekly.totalSec)} of focus time this week across ${weekly.sessionCount} session${weekly.sessionCount === 1 ? "" : "s"}`
      : "No focus sessions logged yet this week"
    : null;

  return (
    <div className="space-y-4">
      <ActiveSessionBanner />

      {/* The greeting is its own clean moment. Music browsing belongs to the
          workbench below, where it leads directly into current work. */}
      <div>
        <div
          data-tour="today"
          className="today-hero glass-hero prism-edge relative min-h-[224px] overflow-hidden sm:min-h-[244px]"
        >
          <div className="absolute inset-0" aria-hidden>
            <LfWindow field className="today-hero__field absolute inset-0 rounded-panel" />
            {activeArtist ? (
              <ArtistBanner
                artist={activeArtist}
                fadeRight
                className="today-hero__banner absolute inset-0"
              />
            ) : null}
            <div className="today-hero__aperture absolute inset-0" />
            <div className="scrim-reveal absolute inset-0" />
          </div>
          {activeArtist?.logo_url ? (
            <div className="today-hero__logo pointer-events-none absolute inset-y-0 right-0 z-[1] flex w-[min(43%,24rem)] items-end justify-end p-5 sm:p-7">
              <SignedImage
                path={activeArtist.logo_url}
                alt={activeArtist.name}
                className="h-auto max-h-[8rem] w-auto max-w-full object-contain sm:max-h-[11rem]"
              />
            </div>
          ) : null}
          <div className="today-hero__content relative z-[1] flex min-h-[224px] max-w-[58%] flex-col justify-between gap-6 px-6 py-6 sm:min-h-[244px] sm:px-8 sm:py-7">
            <div className="min-w-0">
              <p className="label-mono mb-2.5 text-text-lo/80">Today in the studio</p>
              <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] text-text-hi sm:text-[42px] sm:leading-none">
                {greetingForHour(now.getHours())}
              </h1>
              <p className="mt-2 text-sm text-text-lo">{dateLabel}</p>
              {!tasksFocused && weeklyLabel ? (
                <p className="mt-3 flex max-w-full items-center gap-2 text-xs text-text-lo">
                  <span className="size-1.5 shrink-0 rounded-full bg-amber shadow-[0_0_10px_rgb(255_181_107_/_0.7)]" />
                  <span>{weeklyLabel}</span>
                </p>
              ) : null}
            </div>

            <div>
              <FlareLine className="mb-3 opacity-70" />
              <div className="flex items-start gap-8 sm:gap-10">
                {tasksFocused ? (
                  <>
                    <Stat value={statsQuery.data?.due} label="Due" />
                    <Stat value={openTasks.length} label="Open" tone="amber" />
                    <Stat value={activeProjects.length} label="Projects" />
                  </>
                ) : (
                  <>
                    <Stat value={activeTracks.length} label="Active" tone="amber" />
                    <Stat value={statsQuery.data?.due} label="Due" />
                    <Stat value={statsQuery.data?.sessions} label="Sessions" />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>

      {tasksFocused ? (
        <div
          data-tour="today-actions"
          className="well flex flex-wrap items-center gap-2 px-3 py-2"
        >
          <p className="label-mono mr-2 hidden text-text-lo/70 sm:block">
            Start something
          </p>
          <>
            <Button type="button" size="sm" onClick={() => setTaskOpen(true)}>
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
        </div>
      ) : null}

      {!empty && !tasksFocused && activeArtist && currentUser ? (
        <ActivationGuideModule
          spaceId={activeSpaceId ?? ""}
          artistId={activeArtist.id}
          ownerId={currentUser.id}
          isExistingMember={activeArtist.origin_status === "legacy_complete"}
        />
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
          onToggleTask={handleToggleTodayTask}
        />
      ) : (
        <div className="space-y-4">
          <section className="panel overflow-hidden">
            <TrackCoverSlider tracks={tracks} />
            <div className="grid border-t border-line/60 lg:grid-cols-12">
            <FeaturedTrackCard
              track={featuredTrack}
              stageName={
                featuredTrack
                  ? stages.find((stage) => stage.id === featuredTrack.stage_id)?.name
                  : undefined
              }
              reason={
                featuredTrack
                  ? deriveAttentionSignals({ track: featuredTrack })[0]?.explanation
                  : undefined
              }
              onAddTrack={() => setTrackModalOpen(true)}
              actions={
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setTrackModalOpen(true)}
                  >
                    <Plus className="size-3.5" />
                    Track
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setTaskOpen(true)}
                  >
                    <Plus className="size-3.5" />
                    Task
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSessionTrackId(
                        activeTracks[0]?.id ?? tracks[0]?.id ?? ""
                      );
                      setSessionOpen(true);
                    }}
                  >
                    Log session
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
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
              }
            />

            <section className="border-t border-line/60 bg-bg-1/35 p-5 sm:p-6 lg:col-span-5 lg:border-l lg:border-t-0">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-full border border-ice/20 bg-ice/10 text-ice">
                  <Inbox className="size-4" />
                </span>
                <div>
                  <p className="label-mono">Incoming</p>
                  <p className="mt-1 text-xs text-text-lo">What changed and what is waiting.</p>
                </div>
              </div>
              <PulseModule embedded />
              <div className="mt-4 divide-y divide-line/60 border-y border-line/60">
                <Link
                  href="/tasks"
                  className="flex items-center justify-between py-3 text-sm text-text-hi hover:text-ice"
                >
                  <span>Commitments due</span>
                  <span className="font-data tabular-nums text-amber">{tasksDue.length}</span>
                </Link>
                <div className="flex items-center justify-between py-3 text-sm text-text-lo">
                  <span>Waiting or blocked</span>
                  <span className="font-data tabular-nums text-text-hi">{waiting.length}</span>
                </div>
                <div className="flex items-center justify-between py-3 text-sm text-text-lo">
                  <span>Ready for review</span>
                  <span className="font-data tabular-nums text-text-hi">{review.length}</span>
                </div>
              </div>
            </section>
          </div>
          </section>

          <section className="panel p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-full border border-amber/20 bg-amber/10 text-amber">
                  <ListMusic className="size-4" />
                </span>
                <div>
                  <p className="label-mono">Next up</p>
                  <p className="mt-1 text-sm text-text-lo">
                    The work worth touching after your current song.
                  </p>
                </div>
              </div>
              <span className="font-data text-xs tabular-nums text-text-lo">
                {Math.max(0, prioritized.length - 1) + tasksDue.length} queued
              </span>
            </div>
            {queuedAttention.length === 0 &&
            overdueTasks.length === 0 &&
            upcomingTasks.length === 0 ? (
              <QuietEmpty>You are clear after this. Stay with the song in front of you.</QuietEmpty>
            ) : (
              <ul className="mt-4 divide-y divide-line/60 border-t border-line/60">
                {overdueTasks.map((task) => (
                  <TodayTaskRow
                    key={task.id}
                    task={task}
                    today={today}
                    onToggle={() => handleToggleTodayTask(task)}
                  />
                ))}
                {queuedAttention.map(({ track }) => {
                  const top = deriveAttentionSignals({ track })[0];
                  return (
                    <InMotionRow
                      key={track.id}
                      track={track}
                      stageName={stages.find((stage) => stage.id === track.stage_id)?.name}
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
                {upcomingTasks.map((task) => (
                  <TodayTaskRow
                    key={task.id}
                    task={task}
                    today={today}
                    onToggle={() => handleToggleTodayTask(task)}
                  />
                ))}
              </ul>
            )}
            {prioritized.length > 4 || tasksDue.length > 4 ? (
              <div className="mt-4 flex flex-wrap gap-4 border-t border-line/60 pt-4 text-xs">
                {prioritized.length > 4 ? (
                  <Link href="/tracks" className="text-ice hover:underline">
                    See every active track
                  </Link>
                ) : null}
                {tasksDue.length > 4 ? (
                  <Link href="/tasks" className="text-ice hover:underline">
                    Open all due tasks
                  </Link>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      )}

      {isProHome ? <ProTodayHub /> : null}

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

function FeaturedTrackCard({
  track,
  stageName,
  reason,
  onAddTrack,
  actions,
}: {
  track: Track | null;
  stageName?: string;
  reason?: string;
  onAddTrack: () => void;
  actions: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden p-5 sm:p-6 lg:col-span-7">
      <LfWindow field className="absolute inset-y-0 right-0 w-[58%] opacity-75" aria-hidden />
      <div
        className="absolute inset-0 bg-[linear-gradient(96deg,rgb(var(--bg-0-rgb)_/_0.96)_0%,rgb(var(--bg-0-rgb)_/_0.88)_46%,rgb(var(--bg-0-rgb)_/_0.3)_100%)]"
        aria-hidden
      />
      <div className="relative">
        <p className="label-mono text-amber">Continue working</p>
        {track ? (
          <div className="mt-4 grid gap-5 sm:grid-cols-[132px_minmax(0,1fr)] sm:items-center">
            <Link
              href={`/track/${track.id}`}
              className="group relative aspect-square w-[132px] overflow-hidden rounded-card border border-line shadow-e2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
            >
              <SpectraCoverArt
                trackId={track.id}
                title={track.title}
                artworkUrl={track.artwork_url}
              />
              <span className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
            </Link>
            <div className="min-w-0">
              <p className="font-data text-[11px] uppercase tracking-[0.12em] text-text-lo">
                {stageName ?? "No stage"}
              </p>
              <h2 className="mt-1 truncate font-display text-2xl font-semibold tracking-tight text-text-hi">
                {track.title}
              </h2>
              {reason ? <p className="mt-2 text-sm text-amber">{reason}</p> : null}
              <p className="mt-2 line-clamp-2 text-sm text-text-lo">
                {track.next_action?.trim() || "Open the track and name the next move."}
              </p>
              <Button asChild size="sm" className="mt-4">
                <Link href={`/track/${track.id}`}>
                  Open track
                  <ArrowUpRight className="size-3.5" />
                </Link>
              </Button>
              <div
                data-tour="today-actions"
                className="mt-4 border-t border-line/60 pt-3"
              >
                <p className="label-mono mb-2 text-[10px] text-text-lo/70">
                  Start something
                </p>
                <div className="flex flex-wrap gap-1">{actions}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative mt-4 max-w-md py-5">
            <h2 className="font-display text-xl font-semibold text-text-hi">
              Put a song in motion
            </h2>
            <p className="mt-2 text-sm text-text-lo">
              Mark a track Active and it will become the center of Today.
            </p>
            <Button type="button" size="sm" className="mt-4" onClick={onAddTrack}>
              <Plus className="size-3.5" />
              Track
            </Button>
          </div>
        )}
      </div>
    </section>
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

/** Big glanceable numeral + label. */
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
    <div className="min-w-11">
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
      <p className="label-mono mt-1.5 text-[10px]">{label}</p>
    </div>
  );
}

function SectionHeader({ label, count }: { label: string; count?: number }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <h2 className="label-mono">{label}</h2>
      {count !== undefined && count > 0 ? (
        <span className="font-mono text-xs tabular-nums text-text-lo/70">
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
                  <span className="shrink-0 font-mono text-xs text-text-lo">
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
  const { categories } = useTaskCategoryPalette();
  const category = categories.find((item) => item.key === task.category);
  const cat = category?.label ?? task.category;
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
          <span
            className="rounded-chip border border-line bg-bg-2 px-2 py-0.5 text-[11px] text-text-lo"
            style={taskCategoryChipStyle(category)}
          >
            {cat}
          </span>
          {task.due_date ? (
            <span
              className={cn(
                "font-mono text-[11px]",
                overdue ? "text-warn" : "text-text-lo"
              )}
            >
              {task.due_date}
            </span>
          ) : null}
          {task.track_id ? (
            <Link
              href={`/track/${task.track_id}`}
              className="text-[11px] text-ice hover:underline"
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
    <li className="lift rounded-input px-2 py-3">
      <div className="relative flex items-center gap-3">
        <Link
          href={actionHref ?? `/track/${track.id}`}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <div
            className="relative size-12 shrink-0 overflow-hidden rounded-input border border-line shadow-e1"
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
            <p className="font-mono text-[11px] text-text-lo">
              {stageName ?? "No stage"}
              {" · "}
              {lastSessionQuery.data
                ? `Last session ${formatShortDate(lastSessionQuery.data)}`
                : "No sessions yet"}
            </p>
            {reason ? (
              <p className="mt-0.5 text-xs text-amber">{reason}</p>
            ) : null}
          </div>
        </Link>
        {actionLabel ? (
          <Link
            href={actionHref ?? `/track/${track.id}`}
            className="shrink-0 text-xs text-ice hover:underline"
          >
            {actionLabel}
          </Link>
        ) : null}
      </div>
    </li>
  );
}
