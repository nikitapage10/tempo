"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { SignedImage } from "@/components/ui/signed-image";
import { useToast } from "@/components/ui/toast";
import { EmptyShaderPanel } from "@/components/shader-empty";
import { FlareLine } from "@/components/flare-line";
import { LfWindow } from "@/components/lf-windows";
import { ActiveSessionBanner } from "@/components/track/active-session-banner";
import { StartFocusDialog } from "@/components/track/start-focus-dialog";
import { TrackFormModal } from "@/components/tracks/track-form-modal";
import { useActiveSpace } from "@/components/active-space-provider";
import { useStages } from "@/hooks/use-stages";
import { useWeeklyElapsed } from "@/hooks/use-sessions";
import { useTaskMutations, useTasks } from "@/hooks/use-tasks";
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
import { gradientFromTrackId } from "@/lib/track-style";
import type { Task, Track, TrackInsert } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  deriveAttentionSignals,
  sortTracksByAttention,
} from "@/lib/attention/signals";
import { useQuery } from "@tanstack/react-query";
import { SlitDivider } from "@/components/ui/slit";
import { SpotlightCard } from "@/components/ui/spotlight-card";

function greetingForHour(h: number): string {
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function TodayPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { activeSpaceId, activeSpace } = useActiveSpace();
  const tracksQuery = useTracks(activeSpaceId);
  const stagesQuery = useStages(activeSpaceId);
  const tasksQuery = useTasks();
  const { create: createTrack } = useTrackMutations(activeSpaceId);
  const { create: createTask, update: updateTask } = useTaskMutations();

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
    queryKey: ["today-stats"],
    queryFn: async () => {
      const [due, sessions] = await Promise.all([
        countTasksDueThisWeek(),
        countSessionsThisWeek(),
      ]);
      return { due, sessions };
    },
  });

  const tracks = tracksQuery.data ?? [];
  const stages = stagesQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
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

  const now = new Date();
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const empty = !tracksQuery.isLoading && activeTracks.length === 0 && tasksDue.length === 0;

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
      <LfWindow className="relative overflow-hidden rounded-panel border border-line shadow-e3">
        <div className="scrim-reveal absolute inset-0" aria-hidden />
        <div className="relative flex flex-col gap-6 px-6 py-7 sm:px-8 sm:py-9">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-text-hi sm:text-[40px] sm:leading-[1.05]">
              {greetingForHour(now.getHours())}
            </h1>
            <p className="mt-1.5 text-sm text-text-lo">{dateLabel}</p>
          </div>

          <div className="flex flex-wrap items-start gap-x-10 gap-y-5">
            <Stat value={activeTracks.length} label="Active" tone="amber" />
            <Stat value={statsQuery.data?.due} label="Due" />
            <Stat value={statsQuery.data?.sessions} label="Sessions" />
          </div>

          {weeklyLabel ? (
            <p className="-mt-1 text-xs text-text-lo">{weeklyLabel}</p>
          ) : null}

          <div>
            <FlareLine className="mb-4 max-w-[420px] opacity-60" />
            <div className="flex flex-wrap gap-2">
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
            </div>
          </div>
        </div>
      </LfWindow>

      {empty ? (
        <EmptyShaderPanel
          title="Today is clear"
          copy="Add a track, a task, or log a session — or bring your existing catalog in and TEMPO will organise it with you."
          action={
            <Button asChild>
              <Link href="/import">Bring your music in</Link>
            </Button>
          }
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
            style={{ background: gradientFromTrackId(track.id) }}
          >
            <SignedImage
              path={track.artwork_url}
              className="absolute inset-0 size-full"
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
