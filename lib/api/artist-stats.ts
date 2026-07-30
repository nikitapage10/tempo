import { createClient } from "@/lib/supabase/client";
import type {
  DecisionType,
  Momentum,
  Space,
  Stage,
  Track,
  TrackType,
} from "@/lib/types";

/**
 * Raw rows for the artist overview, scoped to one artist's spaces.
 *
 * Deliberately no new tables or views: an artist's catalog is small enough
 * (hundreds of tracks, a couple of bounces each after pruning) that fetching
 * the narrow columns and rolling up on the client beats a migration the user
 * has to run by hand. Every select lists its columns so this stays cheap as
 * rows grow wider.
 */
export type ArtistStatsRaw = {
  spaces: Space[];
  stages: Stage[];
  tracks: Track[];
  versions: VersionRow[];
  sessions: SessionRow[];
  tasks: TaskRow[];
  projects: ProjectRow[];
  releases: ReleaseRow[];
  comments: CommentRow[];
  decisions: DecisionRow[];
};

export type VersionRow = {
  track_id: string;
  created_at: string;
  duration: number | null;
  file_size: number | null;
};

export type SessionRow = {
  track_id: string;
  logged_at: string;
  started_at: string | null;
  elapsed_sec: number | null;
  status: string;
};

export type TaskRow = {
  space_id: string;
  status: string;
  due_date: string | null;
};

export type ProjectRow = {
  id: string;
  space_id: string;
  name: string;
  project_type: string;
  status: string;
};

export type ReleaseRow = {
  project_id: string;
  release_date: string | null;
  live_url: string | null;
};

export type CommentRow = {
  track_id: string;
  guest_name: string | null;
  resolved: boolean;
  parent_id: string | null;
  created_at: string;
};

export type DecisionRow = {
  track_id: string;
  decision_type: DecisionType;
  created_at: string;
};

const EMPTY: ArtistStatsRaw = {
  spaces: [],
  stages: [],
  tracks: [],
  versions: [],
  sessions: [],
  tasks: [],
  projects: [],
  releases: [],
  comments: [],
  decisions: [],
};

/**
 * Supabase caps `.in()` lists well above a realistic catalog, but chunking
 * keeps the URL under any proxy limit for an artist with a very long history.
 */
const CHUNK = 200;

async function inChunks<T>(
  ids: string[],
  run: (chunk: string[]) => Promise<T[]>
): Promise<T[]> {
  if (ids.length === 0) return [];
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    out.push(...(await run(ids.slice(i, i + CHUNK))));
  }
  return out;
}

export async function fetchArtistStats(
  artistId: string
): Promise<ArtistStatsRaw> {
  const supabase = createClient();

  const { data: spaceRows, error: spacesError } = await supabase
    .from("spaces")
    .select("*")
    .eq("artist_id", artistId)
    .order("sort", { ascending: true });
  if (spacesError) throw spacesError;

  const spaces = (spaceRows ?? []) as Space[];
  const spaceIds = spaces.map((s) => s.id);
  if (spaceIds.length === 0) return { ...EMPTY, spaces };

  const [stagesRes, tracksRes, tasksRes, projectsRes] = await Promise.all([
    supabase
      .from("stages")
      .select("*")
      .in("space_id", spaceIds)
      .order("sort", { ascending: true }),
    supabase.from("tracks").select("*").in("space_id", spaceIds),
    supabase
      .from("tasks")
      .select("space_id, status, due_date")
      .in("space_id", spaceIds),
    supabase
      .from("projects")
      .select("id, space_id, name, project_type, status")
      .in("space_id", spaceIds),
  ]);
  for (const res of [stagesRes, tracksRes, tasksRes, projectsRes]) {
    if (res.error) throw res.error;
  }

  const stages = (stagesRes.data ?? []) as Stage[];
  const tracks = (tracksRes.data ?? []) as Track[];
  const tasks = (tasksRes.data ?? []) as TaskRow[];
  const projects = (projectsRes.data ?? []) as ProjectRow[];

  const trackIds = tracks.map((t) => t.id);
  const releaseProjectIds = projects
    .filter((p) => p.project_type !== "general")
    .map((p) => p.id);

  const [versions, sessions, comments, decisions, releases] = await Promise.all([
    inChunks<VersionRow>(trackIds, async (chunk) => {
      const { data, error } = await supabase
        .from("versions")
        .select("track_id, created_at, duration, file_size")
        .in("track_id", chunk);
      if (error) throw error;
      return (data ?? []) as VersionRow[];
    }),
    inChunks<SessionRow>(trackIds, async (chunk) => {
      const { data, error } = await supabase
        .from("sessions")
        .select("track_id, logged_at, started_at, elapsed_sec, status")
        .in("track_id", chunk);
      if (error) throw error;
      return (data ?? []) as SessionRow[];
    }),
    inChunks<CommentRow>(trackIds, async (chunk) => {
      const { data, error } = await supabase
        .from("comments")
        .select("track_id, guest_name, resolved, parent_id, created_at")
        .in("track_id", chunk);
      if (error) throw error;
      return (data ?? []) as CommentRow[];
    }),
    inChunks<DecisionRow>(trackIds, async (chunk) => {
      const { data, error } = await supabase
        .from("version_decisions")
        .select("track_id, decision_type, created_at")
        .in("track_id", chunk);
      if (error) throw error;
      return (data ?? []) as DecisionRow[];
    }),
    inChunks<ReleaseRow>(releaseProjectIds, async (chunk) => {
      const { data, error } = await supabase
        .from("release_details")
        .select("project_id, release_date, live_url")
        .in("project_id", chunk);
      if (error) throw error;
      return (data ?? []) as ReleaseRow[];
    }),
  ]);

  return {
    spaces,
    stages,
    tracks,
    versions,
    sessions,
    tasks,
    projects,
    releases,
    comments,
    decisions,
  };
}

export type { Momentum, TrackType };
