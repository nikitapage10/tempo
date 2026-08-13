import { createClient } from "@/lib/supabase/client";
import { addDateKey } from "@/lib/calendar/date";
import { localDateString } from "@/lib/format";
import { canRead, type AreaGrants } from "@/lib/team/areas";

export type ArtistHubSnapshot = {
  handle: string | null;
  upcoming: { id: string; title: string; startAt: string }[];
  trackCount: number | null;
  overdue: number | null;
  weekCount: number | null;
  followers: number | null;
  followerDelta: number | null;
  followerPlatform: string | null;
  networkFollowers: number | null;
};

const PLATFORM_LABEL: Record<string, string> = {
  soundcloud: "SoundCloud",
  spotify: "Spotify",
};

function isMissingTable(error: { message?: string } | null): boolean {
  return /schema cache|does not exist|42P01|PGRST205/i.test(error?.message ?? "");
}

export function emptyHubSnapshot(): ArtistHubSnapshot {
  return {
    handle: null,
    upcoming: [],
    trackCount: null,
    overdue: null,
    weekCount: null,
    followers: null,
    followerDelta: null,
    followerPlatform: null,
    networkFollowers: null,
  };
}

export function compactCount(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

export function platformLabel(platform: string | null | undefined): string | null {
  if (!platform) return null;
  return PLATFORM_LABEL[platform] ?? platform;
}

export function signedDelta(n: number | null | undefined): string | null {
  if (n == null) return null;
  if (n > 0) return `+${compactCount(n)}`;
  if (n < 0) return compactCount(n);
  return "0";
}

export function countOverdueFromCatalog(input: {
  tasks: { status: string; due_date: string | null }[];
  tracks: { deadline: string | null }[];
  projects: { status: string; deadline: string | null }[];
  today: string;
}): number {
  let n = 0;
  for (const task of input.tasks) {
    if (task.status !== "done" && task.due_date && task.due_date < input.today) n += 1;
  }
  for (const track of input.tracks) {
    if (track.deadline && track.deadline < input.today) n += 1;
  }
  for (const project of input.projects) {
    if (project.status !== "done" && project.deadline && project.deadline < input.today) {
      n += 1;
    }
  }
  return n;
}

export function countDueThisWeek(input: {
  tasks: { status: string; due_date: string | null }[];
  today: string;
  weekEnd: string;
}): number {
  let n = 0;
  for (const task of input.tasks) {
    if (
      task.status !== "done" &&
      task.due_date &&
      task.due_date >= input.today &&
      task.due_date < input.weekEnd
    ) {
      n += 1;
    }
  }
  return n;
}

export function pickFollowerTrend(
  snapshots: { platform: string; followers: number | null; captured_on: string }[]
): { followers: number; delta: number | null; platform: string } | null {
  const byPlatform = new Map<string, { followers: number; captured_on: string }[]>();
  for (const row of snapshots) {
    if (row.followers == null) continue;
    const list = byPlatform.get(row.platform) ?? [];
    list.push({ followers: row.followers, captured_on: row.captured_on });
    byPlatform.set(row.platform, list);
  }
  let best: { followers: number; delta: number | null; platform: string } | null = null;
  for (const [platform, rows] of Array.from(byPlatform.entries())) {
    rows.sort((a, b) => a.captured_on.localeCompare(b.captured_on));
    const latest = rows[rows.length - 1];
    if (!latest) continue;
    const previous = rows.length > 1 ? rows[rows.length - 2] : null;
    const candidate = {
      platform,
      followers: latest.followers,
      delta: previous ? latest.followers - previous.followers : null,
    };
    if (!best || candidate.followers > best.followers) best = candidate;
  }
  return best;
}

export function summarizeRoster(snapshots: ArtistHubSnapshot[]): {
  overdue: number | null;
  week: number | null;
  tracks: number | null;
  followers: number | null;
  followerDelta: number | null;
  networkFollowers: number | null;
} {
  const sumKnown = (values: (number | null)[]): number | null => {
    const known = values.filter((n): n is number => n != null);
    return known.length === 0 ? null : known.reduce((a, b) => a + b, 0);
  };
  return {
    overdue: sumKnown(snapshots.map((s) => s.overdue)),
    week: sumKnown(snapshots.map((s) => s.weekCount)),
    tracks: sumKnown(snapshots.map((s) => s.trackCount)),
    followers: sumKnown(snapshots.map((s) => s.followers)),
    followerDelta: sumKnown(snapshots.map((s) => s.followerDelta)),
    networkFollowers: sumKnown(snapshots.map((s) => s.networkFollowers)),
  };
}

/** High-level facts a team member may see for an artist they work with. */
export async function fetchArtistHubSnapshot(
  artistId: string,
  areas: AreaGrants
): Promise<ArtistHubSnapshot> {
  const supabase = createClient();
  const snapshot = emptyHubSnapshot();
  const today = localDateString(new Date());
  const weekEnd = addDateKey(today, 7);
  const now = new Date().toISOString();

  const { data: profile } = await supabase
    .from("artist_profiles")
    .select("id, handle")
    .eq("artist_id", artistId)
    .maybeSingle();
  snapshot.handle = (profile?.handle as string | null) ?? null;
  if (profile?.id) {
    const { count } = await supabase
      .from("profile_follows")
      .select("follower_profile_id", { count: "exact", head: true })
      .eq("followee_profile_id", profile.id);
    if (count != null) snapshot.networkFollowers = count;
  }

  const { data: spaces, error: spacesError } = await supabase
    .from("spaces")
    .select("id")
    .eq("artist_id", artistId);
  if (spacesError && !isMissingTable(spacesError)) throw new Error(spacesError.message);
  const spaceIds = (spaces ?? []).map((s) => s.id);

  if (spaceIds.length > 0 && canRead(areas, "catalog")) {
    const [tracksRes, tasksRes, projectsRes] = await Promise.all([
      supabase.from("tracks").select("id, deadline").in("space_id", spaceIds),
      supabase.from("tasks").select("status, due_date").in("space_id", spaceIds),
      supabase.from("projects").select("status, deadline").in("space_id", spaceIds),
    ]);
    if (!tracksRes.error) {
      snapshot.trackCount = (tracksRes.data ?? []).length;
    }
    if (!tracksRes.error && !tasksRes.error && !projectsRes.error) {
      snapshot.overdue = countOverdueFromCatalog({
        tasks: (tasksRes.data ?? []) as { status: string; due_date: string | null }[],
        tracks: (tracksRes.data ?? []) as { deadline: string | null }[],
        projects: (projectsRes.data ?? []) as { status: string; deadline: string | null }[],
        today,
      });
      snapshot.weekCount = countDueThisWeek({
        tasks: (tasksRes.data ?? []) as { status: string; due_date: string | null }[],
        today,
        weekEnd,
      });
    }
  }

  if (spaceIds.length > 0 && canRead(areas, "calendar")) {
    const { data, error } = await supabase
      .from("calendar_events")
      .select("id, title, starts_at, start_date")
      .in("space_id", spaceIds)
      .limit(48);
    if (error && !isMissingTable(error)) throw new Error(error.message);
    const upcoming = (data ?? [])
      .map((row) => ({
        id: row.id as string,
        title: (row.title as string) ?? "Event",
        startAt: (row.starts_at as string | null) ?? (row.start_date as string | null) ?? "",
      }))
      .filter((row) => row.startAt && (row.startAt >= now || row.startAt >= today))
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
    snapshot.upcoming = upcoming.slice(0, 3);
    const calendarWeek = upcoming.filter((row) => row.startAt.slice(0, 10) < weekEnd).length;
    snapshot.weekCount = (snapshot.weekCount ?? 0) + calendarWeek;
  }

  if (canRead(areas, "stats")) {
    const { data, error } = await supabase
      .from("platform_snapshots")
      .select("platform, followers, captured_on")
      .eq("artist_id", artistId)
      .order("captured_on", { ascending: true });
    if (error && !isMissingTable(error) && !/platform_snapshots/i.test(error.message ?? "")) {
      throw new Error(error.message);
    }
    const trend = pickFollowerTrend(
      (data ?? []) as { platform: string; followers: number | null; captured_on: string }[]
    );
    if (trend) {
      snapshot.followers = trend.followers;
      snapshot.followerDelta = trend.delta;
      snapshot.followerPlatform = trend.platform;
    }
  }

  return snapshot;
}
