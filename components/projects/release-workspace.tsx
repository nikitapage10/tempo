"use client";

import * as React from "react";
import { CalendarDays, CheckCircle2, Circle, Download, ListChecks, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { FlareLine } from "@/components/flare-line";
import { ReleasePlanDialog } from "@/components/projects/release-plan-dialog";
import { ReleaseTrackRow } from "@/components/projects/release-track-row";
import { useChecklistForTracks } from "@/hooks/use-checklist";
import { useReleaseDetails, useReleaseMutations, useReleaseTrackMetadata } from "@/hooks/use-release";
import { useVersionsForTracks } from "@/hooks/use-versions";
import { downloadTextFile, toCsv } from "@/lib/csv-export";
import { formatShortDate } from "@/lib/format";
import {
  buildReleaseTimeline,
  computeReleaseReadiness,
  daysUntilRelease,
  isPostRelease,
  tasksAffectedByDateShift,
} from "@/lib/release-readiness";
import type { Project, ReleaseTrackMetadata, Task, Track } from "@/lib/types";
import { cn } from "@/lib/utils";

type ReleaseWorkspaceProps = {
  project: Project;
  tracks: Track[];
  tasks: Task[];
  onUpdateTask: (id: string, patch: { due_date?: string | null }) => Promise<void>;
};

export function ReleaseWorkspace({ project, tracks, tasks, onUpdateTask }: ReleaseWorkspaceProps) {
  const { toast } = useToast();
  const trackIds = React.useMemo(() => tracks.map((t) => t.id), [tracks]);

  const releaseDetailsQuery = useReleaseDetails(project.id);
  const trackMetadataQuery = useReleaseTrackMetadata(project.id);
  const checklistQuery = useChecklistForTracks(trackIds);
  const versionsQuery = useVersionsForTracks(trackIds);
  const { saveDetails, saveTrackMetadata } = useReleaseMutations(project.id);

  const releaseDetails = releaseDetailsQuery.data ?? null;
  const trackMetadata = trackMetadataQuery.data ?? [];
  const checklistByTrack = checklistQuery.data ?? new Map();
  const versionsByTrack = versionsQuery.data ?? new Map();

  const metadataByTrackId = React.useMemo(() => {
    const map = new Map<string, ReleaseTrackMetadata>();
    for (const m of trackMetadata) map.set(m.track_id, m);
    return map;
  }, [trackMetadata]);

  const orderedTracks = React.useMemo(() => {
    return [...tracks].sort((a, b) => {
      const an = metadataByTrackId.get(a.id)?.track_number ?? Number.MAX_SAFE_INTEGER;
      const bn = metadataByTrackId.get(b.id)?.track_number ?? Number.MAX_SAFE_INTEGER;
      if (an !== bn) return an - bn;
      return a.title.localeCompare(b.title);
    });
  }, [tracks, metadataByTrackId]);

  const [releaseDateInput, setReleaseDateInput] = React.useState(releaseDetails?.release_date ?? "");
  const [pendingShift, setPendingShift] = React.useState<{
    oldDate: string;
    newDate: string;
    affected: { task: Task; newDueDate: string }[];
  } | null>(null);
  const [selectedShiftIds, setSelectedShiftIds] = React.useState<Set<string>>(new Set());
  const [planOpen, setPlanOpen] = React.useState(false);

  React.useEffect(() => {
    setReleaseDateInput(releaseDetails?.release_date ?? "");
  }, [releaseDetails?.release_date]);

  async function handleReleaseDateBlur() {
    const newDate = releaseDateInput || null;
    const oldDate = releaseDetails?.release_date ?? null;
    if (newDate === oldDate) return;

    if (oldDate && newDate) {
      const affected = tasksAffectedByDateShift(tasks, project.id, oldDate, newDate);
      if (affected.length > 0) {
        setPendingShift({ oldDate, newDate, affected });
        setSelectedShiftIds(new Set(affected.map((a) => a.task.id)));
        return;
      }
    }
    try {
      await saveDetails.mutateAsync({ release_date: newDate });
      toast("Release date saved", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t save release date.");
    }
  }

  async function confirmShift(applyShift: boolean) {
    if (!pendingShift) return;
    try {
      await saveDetails.mutateAsync({ release_date: pendingShift.newDate });
      if (applyShift) {
        for (const a of pendingShift.affected) {
          if (!selectedShiftIds.has(a.task.id)) continue;
          await onUpdateTask(a.task.id, { due_date: a.newDueDate });
        }
      }
      toast("Release date saved", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t save release date.");
    } finally {
      setPendingShift(null);
    }
  }

  async function saveField(patch: Record<string, string | null>) {
    try {
      await saveDetails.mutateAsync(patch);
      toast("Saved", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t save.");
    }
  }

  async function moveTrack(track: Track, direction: -1 | 1) {
    const idx = orderedTracks.findIndex((t) => t.id === track.id);
    const otherIdx = idx + direction;
    if (otherIdx < 0 || otherIdx >= orderedTracks.length) return;
    const numbers = orderedTracks.map((_, i) => i + 1);
    [numbers[idx], numbers[otherIdx]] = [numbers[otherIdx], numbers[idx]];
    try {
      await Promise.all(
        orderedTracks.map((t, i) =>
          saveTrackMetadata.mutateAsync({ trackId: t.id, patch: { track_number: numbers[i] } })
        )
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t reorder tracks.");
    }
  }

  const readiness = computeReleaseReadiness({
    project,
    releaseDetails,
    tracks,
    trackMetadata,
    versionsByTrack,
    checklistByTrack,
    tasks,
  });

  const timeline = buildReleaseTimeline({ releaseDetails, project, tasks, tracks, versionsByTrack });
  const countdown = daysUntilRelease(releaseDetails?.release_date ?? null);
  const postRelease = isPostRelease(releaseDetails);

  const upcomingTasks = tasks
    .filter((t) => t.project_id === project.id && t.status !== "done" && t.due_date)
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!));

  function exportCsv() {
    const headers = [
      "Track #", "Title", "Version title", "ISRC", "Explicit", "Primary artist",
      "Featured artists", "Writers", "Producers", "Mix engineer", "Mastering engineer",
    ];
    const rows = orderedTracks.map((t, i) => {
      const m = metadataByTrackId.get(t.id);
      return [
        i + 1,
        t.title,
        m?.version_title ?? "",
        m?.isrc ?? "",
        m?.explicit ? "Yes" : "No",
        m?.primary_artist ?? "",
        (m?.featured_artists ?? []).join("; "),
        (m?.writers ?? []).join("; "),
        (m?.producers ?? []).join("; "),
        m?.mix_engineer ?? "",
        m?.mastering_engineer ?? "",
      ];
    });
    downloadTextFile(`${project.name.replace(/[^a-z0-9]+/gi, "-")}-metadata.csv`, toCsv(headers, rows), "text/csv");
    toast("CSV downloaded", "ok");
  }

  return (
    <div className="space-y-4">
      <section className="rounded-card border border-line bg-bg-1 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.08em] text-text-lo">
            <Rocket className="size-3.5 text-amber" />
            Release
          </h2>
          {countdown != null ? (
            <span
              className={cn(
                "font-mono text-xs",
                countdown < 0 ? "text-text-lo" : countdown <= 7 ? "text-amber" : "text-ice"
              )}
            >
              {countdown < 0
                ? `Released ${Math.abs(countdown)} day(s) ago`
                : countdown === 0
                  ? "Releases today"
                  : `${countdown} day(s) to go`}
            </span>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="release-date">Release date</Label>
            <Input
              id="release-date"
              type="date"
              value={releaseDateInput}
              onChange={(e) => setReleaseDateInput(e.target.value)}
              onBlur={() => void handleReleaseDateBlur()}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="pitching-deadline">Pitching deadline</Label>
            <Input
              id="pitching-deadline"
              type="date"
              defaultValue={releaseDetails?.pitching_deadline ?? ""}
              onBlur={(e) => void saveField({ pitching_deadline: e.target.value || null })}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="live-url">Live URL (post-release)</Label>
            <Input
              id="live-url"
              type="url"
              placeholder="https://…"
              defaultValue={releaseDetails?.live_url ?? ""}
              onBlur={(e) => void saveField({ live_url: e.target.value.trim() || null })}
              className="mt-1"
            />
          </div>
        </div>
      </section>

      <section className="rounded-card border border-line bg-bg-1 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.08em] text-text-lo">
            <ListChecks className="size-3.5" />
            Readiness
            <span className="text-text-lo/70">
              {readiness.doneCount}/{readiness.totalCount}
            </span>
          </h2>
          <Button type="button" size="sm" variant="secondary" onClick={() => setPlanOpen(true)}>
            Create release plan
          </Button>
        </div>
        <ul className="space-y-1.5">
          {readiness.items.map((item) => (
            <li key={item.id} className="flex items-start gap-2 text-sm">
              {item.done ? (
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-ok" />
              ) : (
                <Circle className="mt-0.5 size-3.5 shrink-0 text-text-lo" />
              )}
              <span className={item.done ? "text-text-lo line-through" : "text-text-hi"}>
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-card border border-line bg-bg-1 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-mono text-xs uppercase tracking-[0.08em] text-text-lo">
            Track order &amp; status
          </h2>
          <Button type="button" size="sm" variant="ghost" onClick={exportCsv}>
            <Download className="size-3.5" />
            Export CSV
          </Button>
        </div>
        {orderedTracks.length === 0 ? (
          <p className="py-3 text-center text-sm text-text-lo">Attach tracks below to plan the release.</p>
        ) : (
          <ul className="space-y-2">
            {orderedTracks.map((t, i) => (
              <ReleaseTrackRow
                key={t.id}
                track={t}
                index={i}
                total={orderedTracks.length}
                metadata={metadataByTrackId.get(t.id) ?? null}
                versions={versionsByTrack.get(t.id) ?? []}
                onMove={(dir) => void moveTrack(t, dir)}
                onSave={(patch) => saveTrackMetadata.mutateAsync({ trackId: t.id, patch }).then(() => {})}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-card border border-line bg-bg-1 p-4">
        <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.08em] text-text-lo">
          Distribution
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="label-name">Label</Label>
            <Input
              id="label-name"
              defaultValue={releaseDetails?.label_name ?? ""}
              onBlur={(e) => void saveField({ label_name: e.target.value.trim() || null })}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="distributor">Distributor</Label>
            <Input
              id="distributor"
              defaultValue={releaseDetails?.distributor ?? ""}
              onBlur={(e) => void saveField({ distributor: e.target.value.trim() || null })}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="catalog-number">Catalog number</Label>
            <Input
              id="catalog-number"
              defaultValue={releaseDetails?.catalog_number ?? ""}
              onBlur={(e) => void saveField({ catalog_number: e.target.value.trim() || null })}
              className="mt-1 font-mono"
            />
          </div>
          <div>
            <Label htmlFor="upc">UPC</Label>
            <Input
              id="upc"
              defaultValue={releaseDetails?.upc ?? ""}
              onBlur={(e) => void saveField({ upc: e.target.value.trim() || null })}
              className="mt-1 font-mono"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="pre-save">Pre-save URL</Label>
            <Input
              id="pre-save"
              type="url"
              placeholder="https://…"
              defaultValue={releaseDetails?.pre_save_url ?? ""}
              onBlur={(e) => void saveField({ pre_save_url: e.target.value.trim() || null })}
              className="mt-1"
            />
          </div>
        </div>
      </section>

      {upcomingTasks.length > 0 ? (
        <section className="rounded-card border border-line bg-bg-1 p-4">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.08em] text-text-lo">
            Upcoming tasks
          </h2>
          <ul className="space-y-1.5">
            {upcomingTasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-text-hi">{t.title}</span>
                <span className="font-mono text-xs text-text-lo">
                  {formatShortDate(t.due_date! + "T12:00:00")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-card border border-line bg-bg-1 p-4">
        <h2 className="mb-3 flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.08em] text-text-lo">
          <CalendarDays className="size-3.5" />
          Timeline
        </h2>
        {timeline.length === 0 ? (
          <p className="text-sm text-text-lo">
            Set a release date, pitching deadline, or task due dates to build a timeline.
          </p>
        ) : (
          <ol className="relative space-y-3 border-l border-line pl-4">
            {timeline.map((ev) => (
              <li key={ev.id} className="relative">
                <span
                  aria-hidden
                  className={cn(
                    "absolute -left-[19px] top-1 size-2.5 rounded-full border-2",
                    ev.kind === "release"
                      ? "border-amber bg-amber/30"
                      : ev.done
                        ? "border-ok bg-ok/30"
                        : "border-ice bg-ice/20"
                  )}
                />
                <p className={cn("text-sm", ev.done ? "text-text-lo line-through" : "text-text-hi")}>
                  {ev.label}
                </p>
                <p className="font-mono text-xs text-text-lo">
                  {formatShortDate(ev.date.length > 10 ? ev.date : `${ev.date}T12:00:00`)} · {ev.kind}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {postRelease ? (
        <section className="rounded-card border border-ok/30 bg-ok/5 p-4">
          <h2 className="mb-2 flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.08em] text-ok">
            Released
          </h2>
          <p className="text-sm text-text-hi">
            {project.name} went live on {formatShortDate(`${releaseDetails!.release_date}T12:00:00`)}.
          </p>
          {releaseDetails?.live_url ? (
            <a
              href={releaseDetails.live_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-sm text-ice hover:underline"
            >
              {releaseDetails.live_url}
            </a>
          ) : null}
          <FlareLine className="mt-3" />
          <p className="mt-3 text-xs text-text-lo">
            Follow-up tasks (playlist follow-ups, recap posts) still show above under Upcoming tasks.
          </p>
        </section>
      ) : null}

      <ReleasePlanDialog
        open={planOpen}
        onOpenChange={setPlanOpen}
        projectId={project.id}
        spaceId={project.space_id}
        releaseDate={releaseDetails?.release_date ?? null}
        tracks={tracks.map((t) => ({ id: t.id, title: t.title }))}
        checklistByTrack={checklistByTrack}
        tasks={tasks}
      />

      {pendingShift ? (
        <DateShiftDialog
          affected={pendingShift.affected}
          selected={selectedShiftIds}
          onToggle={(id) =>
            setSelectedShiftIds((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
          onSkip={() => void confirmShift(false)}
          onApply={() => void confirmShift(true)}
        />
      ) : null}
    </div>
  );
}

function DateShiftDialog({
  affected,
  selected,
  onToggle,
  onSkip,
  onApply,
}: {
  affected: { task: Task; newDueDate: string }[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSkip: () => void;
  onApply: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative z-10 w-full max-w-lg rounded-card border border-line bg-bg-1 p-5 shadow-raise">
        <h2 className="font-display text-lg font-semibold text-text-hi">Shift task dates too?</h2>
        <p className="mt-1 text-sm text-text-lo">
          The release date moved. Pick which open tasks should shift with it — completed tasks never move.
        </p>
        <ul className="mt-3 max-h-[40vh] space-y-1.5 overflow-y-auto">
          {affected.map(({ task, newDueDate }) => (
            <li key={task.id}>
              <label className="flex items-center justify-between gap-2 rounded-input border border-line bg-bg-2/50 px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected.has(task.id)}
                    onChange={() => onToggle(task.id)}
                    className="size-3.5 accent-[var(--ice)]"
                  />
                  {task.title}
                </span>
                <span className="font-mono text-xs text-text-lo">
                  {task.due_date} → {newDueDate}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onSkip}>
            Save date only
          </Button>
          <Button type="button" onClick={onApply}>
            Save + shift selected
          </Button>
        </div>
      </div>
    </div>
  );
}
