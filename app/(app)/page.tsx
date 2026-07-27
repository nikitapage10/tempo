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
import { TrackFormModal } from "@/components/tracks/track-form-modal";
import { useActiveSpace } from "@/components/active-space-provider";
import { useStages } from "@/hooks/use-stages";
import { useTaskMutations, useTasks } from "@/hooks/use-tasks";
import { useTrackMutations, useTracks } from "@/hooks/use-tracks";
import { createSession, countSessionsThisWeek } from "@/lib/api/sessions";
import { countTasksDueThisWeek } from "@/lib/api/tasks";
import { createClient } from "@/lib/supabase/client";
import {
  addDays,
  formatShortDate,
  localDateString,
  startOfLocalDay,
} from "@/lib/format";
import { TASK_CATEGORIES } from "@/lib/constants";
import { gradientFromTrackId } from "@/lib/track-style";
import type { Task, Track, TrackInsert } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

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

  return (
    <div className="space-y-5">
      {/* Today hero window — knockout type lands in Step 6 */}
      <LfWindow className="relative min-h-[140px] overflow-hidden rounded-card border border-line">
        <div className="lf-window-scrim absolute inset-0" aria-hidden />
        <div className="relative px-5 py-6 sm:px-6 sm:py-7">
          <p className="font-display text-xl font-semibold tracking-tight text-text-hi sm:text-2xl">
            {greetingForHour(now.getHours())}
          </p>
          <p className="mt-1 text-sm text-text-lo">{dateLabel}</p>
          <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo sm:text-xs">
            <span className="text-amber">{activeTracks.length}</span>
            <span>active</span>
            <FlareLine variant="tick" />
            <span className="text-amber">{statsQuery.data?.due ?? "—"}</span>
            <span>due</span>
            <FlareLine variant="tick" />
            <span className="text-amber">
              {statsQuery.data?.sessions ?? "—"}
            </span>
            <span>sessions</span>
          </p>
        </div>
      </LfWindow>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => setTrackModalOpen(true)}>
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
      </div>

      {empty ? (
        <EmptyShaderPanel
          title="Today is clear"
          copy="Add a track, a task, or log a session."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-card border border-line bg-bg-1 p-4">
            <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo">
              Tasks due
            </h2>
            {tasksQuery.isLoading ? (
              <div className="h-20 animate-pulse rounded-card bg-bg-2" />
            ) : tasksDue.length === 0 ? (
              <p className="text-sm text-text-lo">Nothing due this week.</p>
            ) : (
              <ul className="space-y-2">
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

          <section className="rounded-card border border-line bg-bg-1 p-4">
            <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo">
              In motion
            </h2>
            {tracksQuery.isLoading ? (
              <div className="h-20 animate-pulse rounded-card bg-bg-2" />
            ) : activeTracks.length === 0 ? (
              <p className="text-sm text-text-lo">
                No active tracks in{" "}
                {activeSpace?.name ?? "this space"}. Mark momentum Active on a
                track to see it here.
              </p>
            ) : (
              <ul className="space-y-2">
                {activeTracks.map((track) => (
                  <InMotionRow
                    key={track.id}
                    track={track}
                    stageName={
                      stages.find((s) => s.id === track.stage_id)?.name
                    }
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
    <li className="flex items-start gap-2.5">
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
}: {
  track: Track;
  stageName?: string;
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
    <li>
      <Link
        href={`/track/${track.id}`}
        className="flex items-center gap-3 rounded-input border border-line bg-bg-2/40 px-2.5 py-2 transition-colors duration-hover hover:border-ice/40"
      >
        <div
          className="relative size-9 shrink-0 overflow-hidden rounded-input border border-line"
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
        </div>
      </Link>
    </li>
  );
}
