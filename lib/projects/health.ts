import type { ChecklistItem, Task, Track } from "@/lib/types";

export type ProjectMilestone = {
  key: string;
  date: string;
  label: string;
  tone: "ice" | "amber" | "ok" | "warn";
};

export type ChecklistRollup = { done: number; total: number };

/** Per-track done/total from a flat checklist list or a track→items map. */
export function checklistRollupByTrack(
  items: ChecklistItem[] | Map<string, ChecklistItem[]>
): Map<string, ChecklistRollup> {
  const map = new Map<string, ChecklistRollup>();
  const list: ChecklistItem[] = Array.isArray(items)
    ? items
    : Array.from(items.values()).flat();
  for (const item of list) {
    const agg = map.get(item.track_id) ?? { done: 0, total: 0 };
    agg.total += 1;
    if (item.done) agg.done += 1;
    map.set(item.track_id, agg);
  }
  return map;
}

/**
 * Combined project progress: each task is one unit (done/open); each checklist
 * item on an attached track is one unit. Tracks with no checklist items do not
 * dilute the dial.
 */
export function projectProgressPct(
  tasks: Task[],
  rollupByTrack: Map<string, ChecklistRollup>,
  trackIds: string[]
): number | null {
  let done = 0;
  let total = 0;
  for (const task of tasks) {
    total += 1;
    if (task.status === "done") done += 1;
  }
  for (const trackId of trackIds) {
    const rollup = rollupByTrack.get(trackId);
    if (!rollup || rollup.total === 0) continue;
    done += rollup.done;
    total += rollup.total;
  }
  if (total === 0) return null;
  return Math.round((done / total) * 100);
}

export type NextUpCandidate = { label: string; date: string; kind: "milestone" | "task" | "track" };

/** Soonest upcoming milestone, dated open task, or track next-action due. */
export function pickNextUp(
  milestones: ProjectMilestone[],
  tasks: Task[],
  tracks: Track[],
  today: string
): NextUpCandidate | null {
  const candidates: NextUpCandidate[] = [];

  for (const m of milestones) {
    if (m.key === "created") continue;
    if (m.date < today) continue;
    candidates.push({ label: m.label, date: m.date, kind: "milestone" });
  }
  for (const t of tasks) {
    if (t.status === "done" || !t.due_date || t.due_date < today) continue;
    candidates.push({ label: t.title, date: t.due_date, kind: "task" });
  }
  for (const track of tracks) {
    if (!track.next_action_due || track.next_action_due < today) continue;
    const label = track.next_action?.trim()
      ? `${track.title}: ${track.next_action.trim()}`
      : track.title;
    candidates.push({ label, date: track.next_action_due, kind: "track" });
  }

  candidates.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return candidates[0] ?? null;
}

export type TrackHealthRow = {
  track: Track;
  checklistPct: number | null;
  overdue: boolean;
};

/** Attached tracks ordered by overdue next-action, then soonest due, then title. */
export function sortTrackHealthRows(
  tracks: Track[],
  rollupByTrack: Map<string, ChecklistRollup>,
  today: string
): TrackHealthRow[] {
  return tracks
    .map((track) => {
      const rollup = rollupByTrack.get(track.id);
      const checklistPct =
        rollup && rollup.total > 0
          ? Math.round((rollup.done / rollup.total) * 100)
          : null;
      const overdue = Boolean(
        track.next_action_due && track.next_action_due < today
      );
      return { track, checklistPct, overdue };
    })
    .sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      const aDue = a.track.next_action_due;
      const bDue = b.track.next_action_due;
      if (aDue && bDue && aDue !== bDue) return aDue < bDue ? -1 : 1;
      if (aDue && !bDue) return -1;
      if (!aDue && bDue) return 1;
      return a.track.title.localeCompare(b.track.title);
    });
}
