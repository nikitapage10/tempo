import type { SupabaseClient } from "@supabase/supabase-js";
import { summarizeArtist, type ArtistOverview } from "@/lib/artist-stats";
import { normalizeTrackType } from "@/lib/track-style";
import type { Space, Stage, Track } from "@/lib/types";
import {
  deriveAttributes,
  type Attribute,
  type AttributeKey,
  type PointEvent,
} from "./attributes";
import type { AchievementContext } from "./achievements";

/**
 * Server-side raw fetch + rollup, shared by evaluate.ts (score what's there)
 * and backfill.ts (seed history, then score). Runs against the caller's
 * authenticated, RLS-scoped Supabase client — every table read here already
 * has an owner-only select policy, so there's nothing this needs the
 * service-role client for. Only the two gamification ledger tables
 * (artist_point_events, artist_achievements) require the admin client to
 * write, and that happens in evaluate.ts / backfill.ts, not here.
 */

type AnyClient = SupabaseClient;

export type GamificationContext = {
  userId: string;
  artistId: string;
  now: Date;
  overview: ArtistOverview;
  achievementContext: AchievementContext;
  attributesByKey: Record<AttributeKey, Attribute>;
  awardedKeys: Set<string>;
};

async function fetchOverview(
  supabase: AnyClient,
  artistId: string,
  now: Date
): Promise<ArtistOverview> {
  const { data: spaceRows, error: spacesError } = await supabase
    .from("spaces")
    .select("*")
    .eq("artist_id", artistId)
    .order("sort", { ascending: true });
  if (spacesError) throw spacesError;
  const spaces = (spaceRows ?? []) as Space[];
  const spaceIds = spaces.map((s) => s.id);

  if (spaceIds.length === 0) {
    return summarizeArtist(
      {
        spaces,
        stages: [],
        tracks: [],
        versions: [],
        sessions: [],
        tasks: [],
        projects: [],
        releases: [],
        comments: [],
        decisions: [],
      },
      now
    );
  }

  const [stagesRes, tracksRes, tasksRes, projectsRes] = await Promise.all([
    supabase.from("stages").select("*").in("space_id", spaceIds).order("sort", { ascending: true }),
    supabase.from("tracks").select("*").in("space_id", spaceIds),
    supabase.from("tasks").select("space_id, status, due_date").in("space_id", spaceIds),
    supabase.from("projects").select("id, space_id, name, project_type, status").in("space_id", spaceIds),
  ]);
  for (const res of [stagesRes, tracksRes, tasksRes, projectsRes]) {
    if (res.error) throw res.error;
  }

  const stages = (stagesRes.data ?? []) as Stage[];
  const tracks = ((tracksRes.data ?? []) as Track[]).map((t) => ({
    ...t,
    type: normalizeTrackType(t.type),
  }));
  const tasks = tasksRes.data ?? [];
  const projects = projectsRes.data ?? [];
  const trackIds = tracks.map((t) => t.id);
  const releaseProjectIds = projects
    .filter((p) => p.project_type !== "general")
    .map((p) => p.id);

  const chunk = <T,>(ids: string[]) => ids.slice(0, 200); // one page is plenty for a single artist's read here

  const [versionsRes, sessionsRes, commentsRes, decisionsRes, releasesRes] = await Promise.all([
    trackIds.length
      ? supabase.from("versions").select("track_id, created_at, duration, file_size").in("track_id", chunk(trackIds))
      : Promise.resolve({ data: [], error: null }),
    trackIds.length
      ? supabase.from("sessions").select("track_id, logged_at, started_at, elapsed_sec, status").in("track_id", chunk(trackIds))
      : Promise.resolve({ data: [], error: null }),
    trackIds.length
      ? supabase.from("comments").select("track_id, guest_name, resolved, parent_id, created_at").in("track_id", chunk(trackIds))
      : Promise.resolve({ data: [], error: null }),
    trackIds.length
      ? supabase.from("version_decisions").select("track_id, decision_type, created_at").in("track_id", chunk(trackIds))
      : Promise.resolve({ data: [], error: null }),
    releaseProjectIds.length
      ? supabase.from("release_details").select("project_id, release_date, live_url").in("project_id", chunk(releaseProjectIds))
      : Promise.resolve({ data: [], error: null }),
  ]);

  return summarizeArtist(
    {
      spaces,
      stages,
      tracks,
      versions: versionsRes.data ?? [],
      sessions: sessionsRes.data ?? [],
      tasks,
      projects,
      releases: releasesRes.data ?? [],
      comments: commentsRes.data ?? [],
      decisions: decisionsRes.data ?? [],
    },
    now
  );
}

export async function buildGamificationContext(
  supabase: AnyClient,
  userId: string,
  artistId: string,
  now: Date = new Date()
): Promise<GamificationContext> {
  const overview = await fetchOverview(supabase, artistId, now);

  const [pointsRes, transitionsRes, performancesRes, snapshotsRes, originRes, onboardingRes, achievementsRes] =
    await Promise.all([
      supabase
        .from("artist_point_events")
        .select("id, rule_key, attribute, points, subject_type, subject_id, occurred_at")
        .eq("artist_id", artistId)
        .order("occurred_at", { ascending: true }),
      supabase
        .from("stage_transitions")
        .select("source, direction, entered_at, dwell_sec")
        .eq("user_id", userId)
        .order("entered_at", { ascending: true }),
      supabase
        .from("performances")
        .select("id, role, context, performed_on")
        .eq("artist_id", artistId),
      supabase
        .from("platform_snapshots")
        .select("platform, followers, captured_on")
        .eq("artist_id", artistId)
        .order("captured_on", { ascending: false }),
      supabase.from("artists").select("origin_status").eq("id", artistId).maybeSingle(),
      supabase
        .from("member_onboarding")
        .select("checklist_completed_at")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase.from("artist_achievements").select("achievement_key").eq("artist_id", artistId),
    ]);

  for (const res of [pointsRes, transitionsRes, performancesRes, snapshotsRes]) {
    if (res.error) throw res.error;
  }

  const pointEvents: PointEvent[] = (pointsRes.data ?? []).map((r) => ({
    id: r.id,
    ruleKey: r.rule_key,
    attribute: r.attribute as AttributeKey,
    points: r.points,
    subjectType: r.subject_type,
    subjectId: r.subject_id,
    occurredAt: r.occurred_at,
  }));

  const forwardTriggerTransitions = (transitionsRes.data ?? []).filter(
    (t) => t.source === "trigger" && t.direction === 1
  );
  const hasMeasuredVelocity = forwardTriggerTransitions.length > 0;
  const fastestForwardDwellHours = forwardTriggerTransitions.reduce<number | null>(
    (min, t) => {
      if (t.dwell_sec == null) return min;
      const hours = t.dwell_sec / 3600;
      return min === null ? hours : Math.min(min, hours);
    },
    null
  );
  const firstTransition = (transitionsRes.data ?? [])[0];

  const performances = (performancesRes.data ?? []).map((p) => ({
    role: p.role as string,
    context: p.context as string,
    performedOn: p.performed_on as string,
  }));
  const performanceCount = performances.length;
  const festivalCount = performances.filter((p) => p.context === "festival").length;
  const firstPerformanceAt =
    performances.length > 0
      ? [...performances].sort((a, b) => a.performedOn.localeCompare(b.performedOn))[0].performedOn
      : null;

  const snapshots = snapshotsRes.data ?? [];
  const latestByPlatform = new Map<string, { followers: number | null; captured_on: string }>();
  for (const s of snapshots) {
    if (!latestByPlatform.has(s.platform)) {
      latestByPlatform.set(s.platform, { followers: s.followers, captured_on: s.captured_on });
    }
  }
  const hasAnyPlatformSnapshot = latestByPlatform.size > 0;
  const maxFollowers = Array.from(latestByPlatform.values()).reduce(
    (sum, s) => sum + (s.followers ?? 0),
    0
  );
  const newestCapturedOn = Array.from(latestByPlatform.values())
    .map((s) => s.captured_on)
    .sort()
    .at(-1);
  const reachFresh = newestCapturedOn
    ? now.getTime() - new Date(`${newestCapturedOn}T12:00:00`).getTime() <= 30 * 86_400_000
    : false;

  const originStatus = originRes.data?.origin_status ?? null;
  const originCompleted = originStatus === "complete" || originStatus === "legacy_complete";
  const onboardingChecklistCompleted = !!onboardingRes.data?.checklist_completed_at;

  const attributes = deriveAttributes(
    {
      pointEvents,
      hasMeasuredVelocity,
      velocityMeasuringSince: firstTransition?.entered_at ?? null,
      reachFresh,
      hasAnyPlatformSnapshot,
      hasAnyPerformance: performanceCount > 0,
    },
    now
  );
  const attributesByKey = Object.fromEntries(
    attributes.map((a) => [a.key, a])
  ) as Record<AttributeKey, Attribute>;

  const finishedCount = pointEvents.filter((e) => e.ruleKey === "track_finished").length;
  const bounceCount = pointEvents.filter((e) => e.ruleKey === "bounce_uploaded").length;
  const masterCount = pointEvents.filter((e) => e.ruleKey === "master_uploaded").length;
  const stageAdvanceCount = pointEvents.filter((e) => e.ruleKey === "stage_advanced").length;
  const sessionCompletedCount = pointEvents.filter((e) => e.ruleKey === "session_completed").length;

  const achievementContext: AchievementContext = {
    now,
    overview,
    attributesByKey,
    pointEvents,
    finishedCount,
    bounceCount,
    masterCount,
    stageAdvanceCount,
    sessionCompletedCount,
    performanceCount,
    festivalCount,
    firstPerformanceAt,
    performances,
    maxFollowers,
    hasAnyPlatform: hasAnyPlatformSnapshot,
    originCompleted,
    onboardingChecklistCompleted,
    fastestForwardDwellHours,
  };

  const awardedKeys = new Set(
    (achievementsRes.data ?? []).map((r) => r.achievement_key as string)
  );

  return { userId, artistId, now, overview, achievementContext, attributesByKey, awardedKeys };
}
