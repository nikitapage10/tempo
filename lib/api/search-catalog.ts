import { createClient } from "@/lib/supabase/client";
import { fetchPeople } from "@/lib/api/people";
import { fetchHomeTimeline } from "@/lib/api/feed";
import { fetchArtistProfile } from "@/lib/api/artist-profile";
import { fetchConversations } from "@/lib/api/messages";
import { fetchSupportThreads, type SupportThread } from "@/lib/api/support-messages";
import type {
  BoardNote,
  Momentum,
  Person,
  Post,
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

/** Feed posts you can already see — your own plus who you follow. */
export type SearchPost = Pick<
  Post,
  "id" | "body" | "created_at" | "attachment_snapshot"
> & {
  author_handle: string | null;
  author_display_name: string | null;
  author_emblem_url: string | null;
};

/**
 * A conversation you're part of — direct or TEMPO Support. `transcript` holds
 * the recent message bodies so search finds a thread by something said in it,
 * not just by who it's with.
 */
export type SearchMessageThread = {
  id: string;
  kind: "direct" | "support";
  title: string;
  handle: string | null;
  preview: string;
  transcript: string;
  emblem_url: string | null;
  archived: boolean;
};

export type SearchCatalog = {
  tracks: SearchTrack[];
  projects: SearchProject[];
  tasks: SearchTask[];
  people: Person[];
  notes: SearchNote[];
  stages: SearchStage[];
  spaces: Pick<Space, "id" | "name" | "focus">[];
  posts: SearchPost[];
  messages: SearchMessageThread[];
};

/**
 * Recent bodies across the caller's conversations, keyed by conversation.
 * Archived threads are indexed too — archiving files a conversation away, it
 * doesn't make it unfindable.
 */
async function fetchMessageThreads(artistId: string): Promise<SearchMessageThread[]> {
  const supabase = createClient();
  const threads: SearchMessageThread[] = [];

  const profile = await fetchArtistProfile(artistId).catch(() => null);
  if (profile?.id) {
    const [inbox, archivedInbox] = await Promise.all([
      fetchConversations(profile.id, false).catch(() => []),
      fetchConversations(profile.id, true).catch(() => []),
    ]);
    const conversations = [
      ...inbox.map((conversation) => ({ conversation, archived: false })),
      ...archivedInbox.map((conversation) => ({ conversation, archived: true })),
    ];
    const ids = conversations.map((entry) => entry.conversation.id);
    const bodies = new Map<string, string[]>();
    if (ids.length) {
      const { data } = await supabase
        .from("messages")
        .select("conversation_id, body")
        .in("conversation_id", ids)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(600);
      for (const row of data ?? []) {
        const list = bodies.get(row.conversation_id) ?? [];
        if (list.length < 25 && row.body) list.push(row.body as string);
        bodies.set(row.conversation_id, list);
      }
    }
    for (const { conversation, archived } of conversations) {
      threads.push({
        id: conversation.id,
        kind: "direct",
        title: conversation.peer?.display_name ?? conversation.title ?? "Conversation",
        handle: conversation.peer?.handle ?? null,
        preview: conversation.last_message_preview ?? "No messages yet",
        transcript: (bodies.get(conversation.id) ?? []).join(" · "),
        emblem_url: conversation.peer?.emblem_url ?? null,
        archived,
      });
    }
  }

  const empty = { reports: [] as SupportThread[] };
  const [support, archivedSupport] = await Promise.all([
    fetchSupportThreads(false).catch(() => empty),
    fetchSupportThreads(true).catch(() => empty),
  ]);
  for (const [reports, archived] of [
    [support.reports ?? [], false],
    [archivedSupport.reports ?? [], true],
  ] as Array<[SupportThread[], boolean]>) {
    for (const report of reports) {
      threads.push({
        id: report.id,
        kind: "support",
        title: report.subject,
        handle: null,
        preview: report.messages.at(-1)?.body ?? report.details,
        transcript: [report.details, ...report.messages.map((message) => message.body)].join(" · "),
        emblem_url: null,
        archived,
      });
    }
  }

  return threads;
}

function toSearchPosts(posts: Post[]): SearchPost[] {
  return posts.map((p) => ({
    id: p.id,
    body: p.body,
    created_at: p.created_at,
    attachment_snapshot: p.attachment_snapshot,
    author_handle: p.author?.handle ?? null,
    author_display_name: p.author?.display_name ?? null,
    author_emblem_url: p.author?.emblem_url ?? null,
  }));
}

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
    const [people, feedPosts, messages] = await Promise.all([
      fetchPeople().catch(() => [] as Person[]),
      fetchHomeTimeline({ limit: 100 }).catch(() => [] as Post[]),
      fetchMessageThreads(artistId).catch(() => [] as SearchMessageThread[]),
    ]);
    return {
      tracks: [],
      projects: [],
      tasks: [],
      people,
      notes: [],
      stages: [],
      spaces: [],
      posts: toSearchPosts(feedPosts),
      messages,
    };
  }

  const [tracksRes, projectsRes, tasksRes, notesRes, stagesRes, people, feedPosts, messages] =
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
      fetchHomeTimeline({ limit: 100 }).catch(() => [] as Post[]),
      fetchMessageThreads(artistId).catch(() => [] as SearchMessageThread[]),
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
    posts: toSearchPosts(feedPosts),
    messages,
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
