import { createClient } from "@/lib/supabase/client";
import { fetchPeople } from "@/lib/api/people";
import type {
  BoardNote,
  Momentum,
  Person,
  Project,
  ProjectType,
  Space,
  Stage,
  Task,
  Track,
  TrackType,
} from "@/lib/types";

/** Lightweight track row for client-side search (artist-wide). */
export type SearchTrack = Pick<
  Track,
  | "id"
  | "space_id"
  | "title"
  | "artist_alias"
  | "type"
  | "bpm"
  | "musical_key"
  | "genre"
  | "destination"
  | "momentum"
  | "tags"
  | "notes"
  | "next_action"
  | "waiting_on"
  | "blocked_reason"
  | "artwork_url"
> & { space_name: string };

export type SearchProject = Pick<
  Project,
  "id" | "space_id" | "name" | "description" | "project_type" | "status"
> & { space_name: string };

export type SearchTask = Pick<
  Task,
  | "id"
  | "space_id"
  | "title"
  | "category"
  | "status"
  | "notes"
  | "track_id"
  | "project_id"
> & { space_name: string | null };

export type SearchNote = Pick<
  BoardNote,
  "id" | "space_id" | "stage_id" | "title" | "body"
> & { space_name: string; stage_name: string | null };

export type SearchStage = Pick<Stage, "id" | "space_id" | "name" | "sort"> & {
  space_name: string;
};

export type SearchCatalog = {
  tracks: SearchTrack[];
  projects: SearchProject[];
  tasks: SearchTask[];
  people: Person[];
  notes: SearchNote[];
  stages: SearchStage[];
  spaces: Pick<Space, "id" | "name" | "focus">[];
};

/**
 * One round-trip bundle of everything global search needs for an artist.
 * Fields are trimmed to what the matcher actually reads.
 */
export async function fetchSearchCatalog(
  artistId: string
): Promise<SearchCatalog> {
  const supabase = createClient();

  const { data: spaces, error: spacesErr } = await supabase
    .from("spaces")
    .select("id, name, focus")
    .eq("artist_id", artistId)
    .order("sort", { ascending: true });
  if (spacesErr) throw spacesErr;

  const spaceList = spaces ?? [];
  const spaceIds = spaceList.map((s) => s.id);
  const spaceName = new Map(spaceList.map((s) => [s.id, s.name]));

  if (spaceIds.length === 0) {
    const people = await fetchPeople().catch(() => [] as Person[]);
    return {
      tracks: [],
      projects: [],
      tasks: [],
      people,
      notes: [],
      stages: [],
      spaces: [],
    };
  }

  const [tracksRes, projectsRes, tasksRes, notesRes, stagesRes, people] =
    await Promise.all([
      supabase
        .from("tracks")
        .select(
          "id, space_id, title, artist_alias, type, bpm, musical_key, genre, destination, momentum, tags, notes, next_action, waiting_on, blocked_reason, artwork_url"
        )
        .in("space_id", spaceIds)
        .order("title", { ascending: true }),
      supabase
        .from("projects")
        .select("id, space_id, name, description, project_type, status")
        .in("space_id", spaceIds)
        .order("name", { ascending: true }),
      supabase
        .from("tasks")
        .select(
          "id, space_id, title, category, status, notes, track_id, project_id"
        )
        .in("space_id", spaceIds)
        .order("title", { ascending: true }),
      supabase
        .from("board_notes")
        .select("id, space_id, stage_id, title, body")
        .in("space_id", spaceIds)
        .order("title", { ascending: true }),
      supabase
        .from("stages")
        .select("id, space_id, name, sort")
        .in("space_id", spaceIds)
        .order("sort", { ascending: true }),
      fetchPeople().catch(() => [] as Person[]),
    ]);

  // Board notes / stages may fail if a migration hasn't been applied — soft-empty.
  const notes = notesRes.error ? [] : (notesRes.data ?? []);
  const stages = stagesRes.error ? [] : (stagesRes.data ?? []);
  if (tracksRes.error) throw tracksRes.error;
  if (projectsRes.error) throw projectsRes.error;
  if (tasksRes.error) throw tasksRes.error;

  const stageName = new Map(stages.map((s) => [s.id, s.name]));

  return {
    spaces: spaceList,
    people,
    tracks: (tracksRes.data ?? []).map((t) => ({
      id: t.id,
      space_id: t.space_id,
      title: t.title,
      artist_alias: t.artist_alias ?? null,
      type: (t.type ?? "original") as TrackType,
      bpm: t.bpm != null ? Number(t.bpm) : null,
      musical_key: t.musical_key ?? null,
      genre: t.genre ?? null,
      destination: t.destination ?? null,
      momentum: (t.momentum ?? "active") as Momentum,
      tags: (t.tags as string[] | null) ?? [],
      notes: t.notes ?? null,
      next_action: t.next_action ?? null,
      waiting_on: t.waiting_on ?? null,
      blocked_reason: t.blocked_reason ?? null,
      artwork_url: t.artwork_url ?? null,
      space_name: spaceName.get(t.space_id) ?? "Space",
    })),
    projects: (projectsRes.data ?? []).map((p) => ({
      id: p.id,
      space_id: p.space_id,
      name: p.name,
      description: p.description ?? null,
      project_type: (p.project_type ?? "general") as ProjectType,
      status: p.status,
      space_name: spaceName.get(p.space_id!) ?? "Space",
    })),
    tasks: (tasksRes.data ?? []).map((t) => ({
      id: t.id,
      space_id: t.space_id,
      title: t.title,
      category: t.category,
      status: t.status,
      notes: t.notes ?? null,
      track_id: t.track_id ?? null,
      project_id: t.project_id ?? null,
      space_name: t.space_id ? spaceName.get(t.space_id) ?? null : null,
    })),
    notes: notes.map((n) => ({
      id: n.id,
      space_id: n.space_id,
      stage_id: n.stage_id,
      title: n.title,
      body: n.body ?? null,
      space_name: spaceName.get(n.space_id) ?? "Space",
      stage_name: stageName.get(n.stage_id) ?? null,
    })),
    stages: stages.map((s) => ({
      id: s.id,
      space_id: s.space_id,
      name: s.name,
      sort: s.sort,
      space_name: spaceName.get(s.space_id) ?? "Space",
    })),
  };
}
