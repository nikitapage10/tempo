import type { ArtistStatsRaw } from "@/lib/api/artist-stats";
import { MOMENTUM_OPTIONS, TRACK_TYPES } from "@/lib/constants";
import { stageProgressFromSort } from "@/lib/stage-hue";
import type { Momentum, Space, Track, TrackType } from "@/lib/types";

/**
 * Pure rollups for the artist overview. No I/O and no `Date.now()` reads that
 * aren't passed in, so every number here is explainable and testable — the
 * "no fake intelligence" rule in FUTURE-PROMPTS applies to stats too.
 */

export type MonthPoint = {
  /** `YYYY-MM`, sortable. */
  key: string;
  /** Short month label; the year is only shown when it changes. */
  label: string;
  showYear: boolean;
  bounces: number;
  started: number;
};

export type StagePoint = {
  id: string;
  name: string;
  spaceId: string;
  spaceName: string;
  count: number;
  /** 0…1 along that space's pipeline — drives the ice → white → amber hue. */
  progress: number;
};

/** Stages grouped under their space, so repeated stage names stay unambiguous. */
export type SpacePipeline = {
  spaceId: string;
  spaceName: string;
  total: number;
  stages: StagePoint[];
};

export type MomentumPoint = {
  value: Momentum;
  label: string;
  count: number;
};

export type BpmBucket = {
  start: number;
  end: number;
  count: number;
};

export type CountPoint = {
  label: string;
  count: number;
};

export type RhythmCell = {
  /** 0 = Monday. */
  day: number;
  hour: number;
  count: number;
};

export type LingeringTrack = {
  track: Track;
  daysOpen: number;
  daysInStage: number;
  stageName: string | null;
};

export type ReleasePoint = {
  projectId: string;
  name: string;
  date: string;
  daysUntil: number;
  isPast: boolean;
  liveUrl: string | null;
};

export type SpaceSummary = {
  space: Space;
  trackCount: number;
  activeCount: number;
  bounceCount: number;
  sessionCount: number;
  focusSec: number;
  openTasks: number;
  projectCount: number;
  topStageName: string | null;
  lastActivityAt: string | null;
};

export type ArtistOverview = {
  hasAnything: boolean;
  spaceCount: number;
  trackCount: number;
  bounceCount: number;
  inProgressCount: number;
  releasedCount: number;
  focusSec: number;
  sessionCount: number;
  catalogSec: number;
  firstActivityAt: string | null;
  monthly: MonthPoint[];
  stages: StagePoint[];
  pipelines: SpacePipeline[];
  momentum: MomentumPoint[];
  bpm: BpmBucket[];
  medianBpm: number | null;
  keys: CountPoint[];
  types: CountPoint[];
  genres: CountPoint[];
  rhythm: RhythmCell[];
  rhythmMax: number;
  bestDayLabel: string | null;
  bestHourLabel: string | null;
  streakWeeks: number;
  lingering: LingeringTrack[];
  releases: ReleasePoint[];
  guestComments: number;
  ownComments: number;
  openThreads: number;
  decisionCount: number;
  approvalCount: number;
  spaces: SpaceSummary[];
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Monday-first day index for a local date. */
function mondayFirstDay(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function parseDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

function topCounts(
  values: (string | null | undefined)[],
  limit: number
): CountPoint[] {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const label = raw?.trim();
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

/** Focus sessions store elapsed_sec; older logged sessions have none. */
function sessionSeconds(elapsed: number | null): number {
  return elapsed && elapsed > 0 ? elapsed : 0;
}

export function summarizeArtist(
  raw: ArtistStatsRaw,
  now = new Date()
): ArtistOverview {
  const { spaces, stages, tracks, versions, sessions, tasks, projects } = raw;

  const stagesById = new Map(stages.map((s) => [s.id, s]));
  const spacesById = new Map(spaces.map((s) => [s.id, s]));

  // ---- headline counts -----------------------------------------------------
  const countedSessions = sessions.filter((s) => s.status !== "active");
  const focusSec = countedSessions.reduce(
    (sum, s) => sum + sessionSeconds(s.elapsed_sec),
    0
  );
  const catalogSec = versions.reduce((sum, v) => sum + (v.duration ?? 0), 0);
  const inProgressCount = tracks.filter(
    (t) => t.momentum === "active" || t.momentum === "simmering"
  ).length;

  const today = now.toISOString().slice(0, 10);
  const projectsById = new Map(projects.map((p) => [p.id, p]));
  const releases: ReleasePoint[] = raw.releases
    .filter((r) => r.release_date)
    .map((r) => {
      const project = projectsById.get(r.project_id);
      const date = r.release_date!;
      const parsed = parseDate(date)!;
      return {
        projectId: r.project_id,
        name: project?.name ?? "Untitled release",
        date,
        daysUntil: daysBetween(now, parsed),
        isPast: date < today,
        liveUrl: r.live_url,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const releasedCount = releases.filter((r) => r.isPast).length;

  // ---- 12-month output -----------------------------------------------------
  const monthBuckets = new Map<string, { bounces: number; started: number }>();
  const months: MonthPoint[] = [];
  let lastYear: number | null = null;
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);
    monthBuckets.set(key, { bounces: 0, started: 0 });
    months.push({
      key,
      label: d.toLocaleDateString(undefined, { month: "short" }),
      showYear: lastYear !== d.getFullYear(),
      bounces: 0,
      started: 0,
    });
    lastYear = d.getFullYear();
  }
  for (const v of versions) {
    const d = parseDate(v.created_at);
    if (!d) continue;
    const bucket = monthBuckets.get(monthKey(d));
    if (bucket) bucket.bounces += 1;
  }
  for (const t of tracks) {
    const d = parseDate(t.created_at);
    if (!d) continue;
    const bucket = monthBuckets.get(monthKey(d));
    if (bucket) bucket.started += 1;
  }
  for (const m of months) {
    const bucket = monthBuckets.get(m.key)!;
    m.bounces = bucket.bounces;
    m.started = bucket.started;
  }

  // ---- pipeline ------------------------------------------------------------
  const stageCounts = new Map<string, number>();
  for (const t of tracks) {
    if (!t.stage_id) continue;
    stageCounts.set(t.stage_id, (stageCounts.get(t.stage_id) ?? 0) + 1);
  }
  const stagesBySpace = new Map<string, typeof stages>();
  for (const s of stages) {
    const list = stagesBySpace.get(s.space_id) ?? [];
    list.push(s);
    stagesBySpace.set(s.space_id, list);
  }
  const stagePoints: StagePoint[] = stages
    .filter((s) => spacesById.get(s.space_id)?.focus !== "tasks")
    .map((s) => ({
      id: s.id,
      name: s.name,
      spaceId: s.space_id,
      spaceName: spacesById.get(s.space_id)?.name ?? "",
      count: stageCounts.get(s.id) ?? 0,
      progress: stageProgressFromSort(s.sort, stagesBySpace.get(s.space_id) ?? []),
    }));

  const pipelines: SpacePipeline[] = spaces
    .filter((space) => space.focus !== "tasks")
    .map((space) => {
      const owned = stagePoints.filter((s) => s.spaceId === space.id);
      return {
        spaceId: space.id,
        spaceName: space.name,
        total: owned.reduce((sum, s) => sum + s.count, 0),
        stages: owned,
      };
    })
    .filter((p) => p.stages.length > 0);

  const momentum: MomentumPoint[] = MOMENTUM_OPTIONS.map((opt) => ({
    value: opt.value,
    label: opt.label,
    count: tracks.filter((t) => t.momentum === opt.value).length,
  }));

  // ---- the sound -----------------------------------------------------------
  const bpms = tracks
    .map((t) => (typeof t.bpm === "number" ? t.bpm : Number(t.bpm)))
    .filter((n): n is number => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  const medianBpm =
    bpms.length === 0
      ? null
      : bpms.length % 2 === 1
        ? bpms[(bpms.length - 1) / 2]
        : Math.round((bpms[bpms.length / 2 - 1] + bpms[bpms.length / 2]) / 2);

  const bpm: BpmBucket[] = [];
  if (bpms.length > 0) {
    const lo = Math.floor(Math.min(...bpms) / 10) * 10;
    const hi = Math.ceil(Math.max(...bpms) / 10) * 10;
    for (let start = lo; start < Math.max(hi, lo + 10); start += 10) {
      bpm.push({
        start,
        end: start + 10,
        count: bpms.filter((n) => n >= start && n < start + 10).length,
      });
    }
  }

  const keys = topCounts(
    tracks.map((t) => t.musical_key),
    8
  );
  const genres = topCounts(
    tracks.map((t) => t.genre),
    6
  );
  const types: CountPoint[] = TRACK_TYPES.map((t) => ({
    label: t.label,
    count: tracks.filter((track) => track.type === (t.value as TrackType)).length,
  })).filter((t) => t.count > 0);

  // ---- work rhythm ---------------------------------------------------------
  const rhythmMap = new Map<string, number>();
  for (const s of countedSessions) {
    const d = parseDate(s.started_at ?? s.logged_at);
    if (!d) continue;
    const key = `${mondayFirstDay(d)}:${d.getHours()}`;
    rhythmMap.set(key, (rhythmMap.get(key) ?? 0) + 1);
  }
  const rhythm: RhythmCell[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      rhythm.push({ day, hour, count: rhythmMap.get(`${day}:${hour}`) ?? 0 });
    }
  }
  const rhythmMax = rhythm.reduce((max, c) => Math.max(max, c.count), 0);

  const dayTotals = DAY_LABELS.map((_, day) =>
    rhythm.filter((c) => c.day === day).reduce((sum, c) => sum + c.count, 0)
  );
  const bestDayIndex = dayTotals.indexOf(Math.max(...dayTotals));
  const bestDayLabel =
    rhythmMax > 0 && dayTotals[bestDayIndex] > 0
      ? DAY_LABELS[bestDayIndex]
      : null;

  const hourTotals = Array.from({ length: 24 }, (_, hour) =>
    rhythm.filter((c) => c.hour === hour).reduce((sum, c) => sum + c.count, 0)
  );
  const bestHour = hourTotals.indexOf(Math.max(...hourTotals));
  const bestHourLabel =
    rhythmMax > 0 && hourTotals[bestHour] > 0 ? formatHourRange(bestHour) : null;

  // Consecutive weeks (counting back from this one) with at least one session.
  const weekKeys = new Set<string>();
  for (const s of countedSessions) {
    const d = parseDate(s.started_at ?? s.logged_at);
    if (d) weekKeys.add(weekKey(d));
  }
  let streakWeeks = 0;
  for (let i = 0; i < 520; i++) {
    const probe = new Date(now);
    probe.setDate(probe.getDate() - i * 7);
    if (!weekKeys.has(weekKey(probe))) break;
    streakWeeks += 1;
  }

  // ---- longest in progress -------------------------------------------------
  const finalStageIdsBySpace = new Map<string, string>();
  stagesBySpace.forEach((list, spaceId) => {
    const last = [...list].sort((a, b) => a.sort - b.sort).at(-1);
    if (last) finalStageIdsBySpace.set(spaceId, last.id);
  });
  const lingering: LingeringTrack[] = tracks
    .filter((t) => {
      if (t.momentum === "parked") return false;
      const finalId = finalStageIdsBySpace.get(t.space_id);
      return !finalId || t.stage_id !== finalId;
    })
    .map((t) => {
      const created = parseDate(t.created_at);
      const entered = parseDate(t.stage_entered_at);
      return {
        track: t,
        daysOpen: created ? daysBetween(created, now) : 0,
        daysInStage: entered ? daysBetween(entered, now) : 0,
        stageName: t.stage_id ? (stagesById.get(t.stage_id)?.name ?? null) : null,
      };
    })
    .sort((a, b) => b.daysOpen - a.daysOpen)
    .slice(0, 5);

  // ---- feedback ------------------------------------------------------------
  const guestComments = raw.comments.filter((c) => !!c.guest_name).length;
  const ownComments = raw.comments.length - guestComments;
  const openThreads = raw.comments.filter(
    (c) => !c.resolved && c.parent_id === null
  ).length;
  const approvalCount = raw.decisions.filter(
    (d) => d.decision_type === "approved"
  ).length;

  // ---- per-space breakdown -------------------------------------------------
  const spaceSummaries: SpaceSummary[] = spaces.map((space) => {
    const spaceTracks = tracks.filter((t) => t.space_id === space.id);
    const spaceTrackIds = new Set(spaceTracks.map((t) => t.id));
    const spaceVersions = versions.filter((v) => spaceTrackIds.has(v.track_id));
    const spaceSessions = countedSessions.filter((s) =>
      spaceTrackIds.has(s.track_id)
    );

    const stageTally = new Map<string, number>();
    for (const t of spaceTracks) {
      if (!t.stage_id) continue;
      stageTally.set(t.stage_id, (stageTally.get(t.stage_id) ?? 0) + 1);
    }
    const topStageId = Array.from(stageTally.entries()).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0];

    const timestamps = [
      ...spaceVersions.map((v) => v.created_at),
      ...spaceSessions.map((s) => s.logged_at),
      ...spaceTracks.map((t) => t.updated_at),
    ].filter(Boolean);

    return {
      space,
      trackCount: spaceTracks.length,
      activeCount: spaceTracks.filter((t) => t.momentum === "active").length,
      bounceCount: spaceVersions.length,
      sessionCount: spaceSessions.length,
      focusSec: spaceSessions.reduce(
        (sum, s) => sum + sessionSeconds(s.elapsed_sec),
        0
      ),
      openTasks: tasks.filter(
        (t) => t.space_id === space.id && t.status !== "done"
      ).length,
      projectCount: projects.filter((p) => p.space_id === space.id).length,
      topStageName: topStageId
        ? (stagesById.get(topStageId)?.name ?? null)
        : null,
      lastActivityAt:
        timestamps.length > 0
          ? timestamps.reduce((max, t) => (t > max ? t : max))
          : null,
    };
  });

  const allTimestamps = [
    ...tracks.map((t) => t.created_at),
    ...versions.map((v) => v.created_at),
  ].filter(Boolean);

  return {
    hasAnything: tracks.length > 0 || tasks.length > 0 || projects.length > 0,
    spaceCount: spaces.length,
    trackCount: tracks.length,
    bounceCount: versions.length,
    inProgressCount,
    releasedCount,
    focusSec,
    sessionCount: countedSessions.length,
    catalogSec,
    firstActivityAt:
      allTimestamps.length > 0
        ? allTimestamps.reduce((min, t) => (t < min ? t : min))
        : null,
    monthly: months,
    stages: stagePoints,
    pipelines,
    momentum,
    bpm,
    medianBpm,
    keys,
    types,
    genres,
    rhythm,
    rhythmMax,
    bestDayLabel,
    bestHourLabel,
    streakWeeks,
    lingering,
    releases,
    guestComments,
    ownComments,
    openThreads,
    decisionCount: raw.decisions.length,
    approvalCount,
    spaces: spaceSummaries,
  };
}

/** ISO-ish week bucket, Monday-first, local time. */
function weekKey(d: Date): string {
  const start = new Date(d);
  start.setDate(d.getDate() - mondayFirstDay(d));
  start.setHours(0, 0, 0, 0);
  return start.toISOString().slice(0, 10);
}

export function formatHourRange(hour: number): string {
  const label = (h: number) => {
    const norm = ((h % 24) + 24) % 24;
    if (norm === 0) return "12am";
    if (norm === 12) return "12pm";
    return norm < 12 ? `${norm}am` : `${norm - 12}pm`;
  };
  return `${label(hour)}–${label(hour + 1)}`;
}

export function formatHours(totalSec: number): string {
  const totalMin = Math.round(totalSec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export const RHYTHM_DAY_LABELS = DAY_LABELS;
