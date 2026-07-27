import type {
  ChecklistItem,
  Project,
  ReleaseDetails,
  ReleaseTrackMetadata,
  Task,
  Track,
  Version,
} from "@/lib/types";

export type ReadinessItem = {
  id: string;
  label: string;
  done: boolean;
  /** Deep-link-ish hint for the UI (which track, if any). */
  trackId?: string | null;
};

export type ReadinessSummary = {
  items: ReadinessItem[];
  doneCount: number;
  totalCount: number;
};

function hasApprovedMaster(
  versions: Version[]
): { hasMaster: boolean; masterIsCurrent: boolean } {
  const master = versions.find(
    (v) => v.is_pinned && v.milestone_type === "master"
  );
  if (!master) return { hasMaster: false, masterIsCurrent: false };
  return { hasMaster: true, masterIsCurrent: master.is_current };
}

/**
 * Transparent readiness list — explicit missing items, never an opaque
 * percentage (FEATURE-SPECS §12). Pass per-track versions/checklist maps
 * keyed by track_id.
 */
export function computeReleaseReadiness(input: {
  project: Project;
  releaseDetails: ReleaseDetails | null;
  tracks: Track[];
  trackMetadata: ReleaseTrackMetadata[];
  versionsByTrack: Map<string, Version[]>;
  checklistByTrack: Map<string, ChecklistItem[]>;
  tasks: Task[];
}): ReadinessSummary {
  const {
    releaseDetails,
    tracks,
    trackMetadata,
    versionsByTrack,
    checklistByTrack,
    tasks,
  } = input;
  const items: ReadinessItem[] = [];

  items.push({
    id: "release-date",
    label: "Release date set",
    done: !!releaseDetails?.release_date,
  });

  items.push({
    id: "distributor",
    label: "Distributor / label set",
    done: !!(releaseDetails?.distributor || releaseDetails?.label_name),
  });

  if (tracks.length === 0) {
    items.push({ id: "tracks", label: "At least one track attached", done: false });
    return {
      items,
      doneCount: items.filter((i) => i.done).length,
      totalCount: items.length,
    };
  }

  for (const track of tracks) {
    const versions = versionsByTrack.get(track.id) ?? [];
    const meta = trackMetadata.find((m) => m.track_id === track.id) ?? null;
    const checklist = checklistByTrack.get(track.id) ?? [];
    const { hasMaster, masterIsCurrent } = hasApprovedMaster(versions);

    items.push({
      id: `${track.id}-master`,
      label: `${track.title}: master pinned`,
      done: hasMaster,
      trackId: track.id,
    });
    if (hasMaster && !masterIsCurrent) {
      items.push({
        id: `${track.id}-master-current`,
        label: `${track.title}: pinned master matches the current version`,
        done: false,
        trackId: track.id,
      });
    }
    items.push({
      id: `${track.id}-artwork`,
      label: `${track.title}: artwork uploaded`,
      done: !!track.artwork_url,
      trackId: track.id,
    });
    items.push({
      id: `${track.id}-metadata`,
      label: `${track.title}: release metadata complete`,
      done: !!(meta?.primary_artist && meta?.isrc),
      trackId: track.id,
    });
    if (checklist.length > 0) {
      const allDone = checklist.every((c) => c.done);
      items.push({
        id: `${track.id}-checklist`,
        label: `${track.title}: checklist complete`,
        done: allDone,
        trackId: track.id,
      });
    }
  }

  const pitchingTasks = tasks.filter(
    (t) => t.project_id === input.project.id && t.category === "pitching"
  );
  items.push({
    id: "pitching",
    label: "At least one pitching task planned",
    done: pitchingTasks.length > 0,
  });

  const incompleteTasks = tasks.filter(
    (t) => t.project_id === input.project.id && t.status !== "done"
  );
  items.push({
    id: "tasks-clear",
    label: "No open release tasks left",
    done: incompleteTasks.length === 0,
  });

  return {
    items,
    doneCount: items.filter((i) => i.done).length,
    totalCount: items.length,
  };
}

export function daysUntilRelease(
  releaseDate: string | null,
  now = new Date()
): number | null {
  if (!releaseDate) return null;
  const target = new Date(`${releaseDate}T23:59:59`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function isPostRelease(
  releaseDetails: ReleaseDetails | null,
  now = new Date()
): boolean {
  if (!releaseDetails?.live_url || !releaseDetails.release_date) return false;
  const days = daysUntilRelease(releaseDetails.release_date, now);
  return days != null && days < 0;
}

export type TimelineEvent = {
  id: string;
  date: string; // ISO date (yyyy-mm-dd) or datetime
  label: string;
  kind: "release" | "pitching" | "task" | "milestone";
  done?: boolean;
};

/** Vertical timeline events, sorted chronologically. */
export function buildReleaseTimeline(input: {
  releaseDetails: ReleaseDetails | null;
  project: Project;
  tasks: Task[];
  tracks: Track[];
  versionsByTrack: Map<string, Version[]>;
}): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const { releaseDetails, project, tasks, tracks, versionsByTrack } = input;

  if (releaseDetails?.pitching_deadline) {
    events.push({
      id: "pitching-deadline",
      date: releaseDetails.pitching_deadline,
      label: "Pitching deadline",
      kind: "pitching",
    });
  }
  if (releaseDetails?.release_date) {
    events.push({
      id: "release-date",
      date: releaseDetails.release_date,
      label: `Release day — ${project.name}`,
      kind: "release",
    });
  }
  for (const t of tasks.filter((t) => t.project_id === project.id)) {
    if (!t.due_date) continue;
    events.push({
      id: `task-${t.id}`,
      date: t.due_date,
      label: t.title,
      kind: "task",
      done: t.status === "done",
    });
  }
  for (const track of tracks) {
    const versions = versionsByTrack.get(track.id) ?? [];
    for (const v of versions) {
      if (v.is_pinned) {
        events.push({
          id: `milestone-${v.id}`,
          date: v.pinned_at ?? v.created_at,
          label: `${track.title}: ${v.milestone_label || v.milestone_type || "milestone"} (v${v.version_no})`,
          kind: "milestone",
        });
      }
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

/** Tasks that would shift if the release date moves by `deltaDays`. Never includes completed tasks. */
export function tasksAffectedByDateShift(
  tasks: Task[],
  projectId: string,
  oldReleaseDate: string,
  newReleaseDate: string
): { task: Task; newDueDate: string }[] {
  const oldTime = new Date(`${oldReleaseDate}T12:00:00`).getTime();
  const newTime = new Date(`${newReleaseDate}T12:00:00`).getTime();
  if (Number.isNaN(oldTime) || Number.isNaN(newTime)) return [];
  const deltaDays = Math.round((newTime - oldTime) / (1000 * 60 * 60 * 24));
  if (deltaDays === 0) return [];

  return tasks
    .filter(
      (t) =>
        t.project_id === projectId &&
        t.status !== "done" &&
        t.due_date &&
        t.due_date <= oldReleaseDate
    )
    .map((t) => {
      const due = new Date(`${t.due_date}T12:00:00`);
      due.setDate(due.getDate() + deltaDays);
      const y = due.getFullYear();
      const m = String(due.getMonth() + 1).padStart(2, "0");
      const d = String(due.getDate()).padStart(2, "0");
      return { task: t, newDueDate: `${y}-${m}-${d}` };
    });
}
