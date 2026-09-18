/**
 * Builds and tears down the PRESIDENT demo workspace.
 *
 * SERVER ONLY. Everything is written through the signed-in member's own client
 * rather than the service role: every row belongs to them, so RLS is exactly
 * the check we want, and a bug here can't reach another account.
 *
 * The demo is a whole extra ARTIST (`artists.demo_kind`). That choice does the
 * heavy lifting:
 *   - Sample data can never mix into the member's real catalog.
 *   - Removing it is one scoped delete rather than hunting rows.
 *   - The member's own artist, its Origin draft and its profile are never
 *     touched, so whatever onboarding they had in progress is still there
 *     — and still gated — the moment the demo goes away.
 *
 * Demo tracks carry no audio. Released tracks reference Spotify's shared
 * catalog artwork, and the PRESIDENT identity images are bundled once with the
 * app. Per-member storage is never filled with duplicate demo binaries.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ALBUM_RELEASE,
  DEMO_BOARD_NOTES,
  DEMO_CALENDAR_EVENTS,
  DEMO_FEEDBACK,
  DEMO_PROFILE,
  DEMO_PROJECTS,
  DEMO_SESSIONS,
  DEMO_SPACES,
  DEMO_STAGES,
  DEMO_TASKS,
  DEMO_TRACKS,
  DEMO_TRACK_GROUPS,
  PRESIDENT_DEMO_KIND,
  PRESIDENT_DEMO_LOGO_URL,
  PRESIDENT_DEMO_PROFILE_URL,
  PRESIDENT_SPOTIFY_ARTIST_ID,
} from "@/lib/demo/president";

type Client = SupabaseClient<any, "public", any>;

export type DemoArtistSummary = {
  artistId: string;
  demoKind: string;
  name: string;
};

export type SeedResult = DemoArtistSummary & {
  /** True when the demo was already there and nothing new was written. */
  alreadyExisted: boolean;
  spaceId: string;
  counts: {
    tracks: number;
    projects: number;
    tasks: number;
    sessions: number;
    feedback: number;
    events: number;
    /** Tracks connected to a real Spotify recording, so they play. */
    spotifyLinked: number;
  };
};

export type DemoReadinessCounts = {
  spaces: number;
  tracks: number;
  projects: number;
  tasks: number;
};

/** A timed-out seed must never masquerade as a finished demo forever. */
export function demoWorkspaceIsReady(counts: DemoReadinessCounts): boolean {
  return (
    counts.spaces >= DEMO_SPACES.length &&
    counts.tracks >= DEMO_TRACKS.length &&
    counts.projects >= DEMO_PROJECTS.length &&
    counts.tasks >= DEMO_TASKS.length
  );
}

function isoDaysAgo(days: number, hour = 12, minutes = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minutes, 0, 0);
  return d.toISOString();
}

function dateFromAlbumOffset(offsetDays: number): string {
  const d = new Date(`${ALBUM_RELEASE}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** Title comparison that survives casing, punctuation and accents. */
function normalizeTitle(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\(feat\.?[^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Connects the seeded tracks to their real Spotify recordings.
 *
 * This is what makes the demo audible. TEMPO's track page already embeds
 * Spotify's own player for any track carrying a `spotify_track_id`, so the
 * released PRESIDENT songs only need that id to start playing — no audio is
 * downloaded or stored, which is both the licensed way to do it and the only
 * way available, since Spotify stopped returning preview files in 2024.
 *
 * Best-effort by design. Spotify credentials are optional, the API can be down,
 * and titles drift between the published listing and the release ("dark heaven"
 * versus "Dark Heaven"). None of that is worth failing a demo build over — the
 * catalog is already complete, and unmatched tracks simply stay silent, which
 * is what the unreleased half of the record does anyway.
 */
async function enrichFromSpotify(
  supabase: Client,
  trackIds: Map<string, string>
): Promise<number> {
  const { fetchSpotifyTrackCatalog } = await import("@/lib/platforms/spotify");

  const { tracks: catalog } = await fetchSpotifyTrackCatalog(
    PRESIDENT_SPOTIFY_ARTIST_ID
  );
  if (!catalog.length) return 0;

  // Several releases can carry the same song (single, then album). Prefer the
  // earliest — that's the one people actually streamed.
  const byTitle = new Map<string, (typeof catalog)[number]>();
  for (const track of catalog) {
    const key = normalizeTitle(track.title);
    const existing = byTitle.get(key);
    if (
      !existing ||
      (track.album.releaseDate ?? "9999").localeCompare(
        existing.album.releaseDate ?? "9999"
      ) < 0
    ) {
      byTitle.set(key, track);
    }
  }

  let matched = 0;
  for (const demoTrack of DEMO_TRACKS) {
    const trackId = trackIds.get(demoTrack.ref);
    const spotify = byTitle.get(normalizeTitle(demoTrack.title));
    if (!trackId || !spotify) continue;

    const { error } = await supabase
      .from("tracks")
      .update({
        spotify_track_id: spotify.id,
        spotify_url: spotify.url,
        spotify_album_id: spotify.album.id,
        spotify_album_name: spotify.album.name,
        spotify_album_url: spotify.album.url,
        spotify_isrc: spotify.isrc,
        spotify_explicit: spotify.explicit,
        spotify_disc_number: spotify.discNumber,
        // Spotify is more authoritative than the hand-entered listing for the
        // things it actually knows; track number and release date stay as
        // seeded, because the demo's campaign timeline is built on them.
        spotify_duration_ms: spotify.durationMs ?? null,
        spotify_artist_names: spotify.artists.map((a) => a.name),
        // Demo artwork is shared catalog media. Keep the remote HTTPS address
        // instead of copying the same album image into every member's private
        // bucket; SignedImage already accepts trusted web URLs.
        artwork_url: spotify.album.artworkUrl,
        spotify_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", trackId);
    if (!error) matched += 1;
  }
  return matched;
}

/** The one demo artist an account is allowed to have, if it has one. */
export async function findDemoArtist(
  supabase: Client
): Promise<DemoArtistSummary | null> {
  const { data, error } = await supabase
    .from("artists")
    .select("id, name, demo_kind")
    .not("demo_kind", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  // Migration 073 not run yet: no demo_kind column, so no demo. Treated as
  // "none" rather than an error so the rest of the app stays usable.
  if (error) return null;
  if (!data) return null;
  return { artistId: data.id, demoKind: data.demo_kind, name: data.name };
}

async function inspectDemoWorkspace(
  supabase: Client,
  artistId: string
): Promise<{ ready: boolean; spaceId: string }> {
  const { data: spaces, error: spacesError } = await supabase
    .from("spaces")
    .select("id")
    .eq("artist_id", artistId)
    .order("sort", { ascending: true });
  if (spacesError || !spaces?.length) return { ready: false, spaceId: "" };

  const spaceIds = spaces.map((space) => space.id);
  const [tracks, projects, tasks] = await Promise.all([
    supabase.from("tracks").select("id", { count: "exact", head: true }).in("space_id", spaceIds),
    supabase.from("projects").select("id", { count: "exact", head: true }).in("space_id", spaceIds),
    supabase.from("tasks").select("id", { count: "exact", head: true }).in("space_id", spaceIds),
  ]);
  if (tracks.error || projects.error || tasks.error) {
    return { ready: false, spaceId: spaces[0].id };
  }

  return {
    ready: demoWorkspaceIsReady({
      spaces: spaces.length,
      tracks: tracks.count ?? 0,
      projects: projects.count ?? 0,
      tasks: tasks.count ?? 0,
    }),
    spaceId: spaces[0].id,
  };
}

/**
 * Claims a profile handle, stepping aside if another account already took it.
 * The handle is globally unique, so "president" is first-come-first-served and
 * a second member trying the demo must not fail because of it.
 */
async function claimHandle(
  supabase: Client,
  profileId: string,
  preferred: string
): Promise<void> {
  const candidates = [
    preferred,
    ...Array.from({ length: 4 }, () =>
      `${preferred}-${Math.random().toString(36).slice(2, 6)}`
    ),
  ];
  for (const handle of candidates) {
    const { error } = await supabase
      .from("artist_profiles")
      .update({ handle })
      .eq("id", profileId);
    if (!error) return;
    // 23505 = taken by someone else. Anything else (a reserved name, a broken
    // policy) isn't going to be fixed by trying another suffix.
    if (error.code !== "23505") return;
  }
  // Out of candidates — a profile with no handle is still a complete demo,
  // it just has no public /p/ link.
}

async function seedProfile(supabase: Client, artistId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile, error } = await supabase
    .from("artist_profiles")
    .upsert(
      {
        artist_id: artistId,
        ...(user?.id ? { owner_user_id: user.id } : {}),
        display_name: DEMO_PROFILE.displayName,
        palette_id: DEMO_PROFILE.paletteId,
        tagline: DEMO_PROFILE.tagline,
        bio: DEMO_PROFILE.bio,
        location: DEMO_PROFILE.location,
        country_code: DEMO_PROFILE.countryCode,
        pronouns: DEMO_PROFILE.pronouns,
        genres: DEMO_PROFILE.genres,
        roles: DEMO_PROFILE.roles,
        links: DEMO_PROFILE.links,
        current_focus_title: DEMO_PROFILE.currentFocusTitle,
        current_focus_body: DEMO_PROFILE.currentFocusBody,
        sound_markers: DEMO_PROFILE.soundMarkers,
        story_sections: DEMO_PROFILE.storySections,
        featured_music: DEMO_PROFILE.featuredMusic,
        emblem_url: PRESIDENT_DEMO_PROFILE_URL,
        banner_url: "/demo/president/banner.jpg",
        // Deliberately not published. The demo shows the Artist page fully
        // filled in; putting a sample identity onto the member network or a
        // public link is not something exploring a demo should ever do.
        visibility: "private",
      },
      { onConflict: "artist_id" }
    )
    .select("id, handle")
    .single();

  if (error || !profile) return;
  if (!profile.handle) {
    await claimHandle(supabase, profile.id, DEMO_PROFILE.handle);
  }
}

/**
 * Links every real (non-demo) profile on this account to the demo profile both
 * ways. Migration 120 allows that same-owner exception; strangers still cannot
 * follow a demo. Best-effort — missing profiles or an unapplied migration must
 * not fail the rest of the seed.
 *
 * Pass `ownerUserId` when calling with the service-role client (no session).
 */
export async function ensureOwnerDemoMutualFollows(
  supabase: Client,
  demoArtistId: string,
  ownerUserId?: string
): Promise<void> {
  let userId = ownerUserId ?? null;
  if (!userId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  }
  if (!userId) return;

  const { data: demoProfile } = await supabase
    .from("artist_profiles")
    .select("id, handle, owner_user_id")
    .eq("artist_id", demoArtistId)
    .maybeSingle();
  if (!demoProfile) return;

  // Keep the sample identity readable and linkable from the owner's Social.
  if (demoProfile.owner_user_id !== userId) {
    await supabase
      .from("artist_profiles")
      .update({ owner_user_id: userId })
      .eq("id", demoProfile.id);
  }
  if (!demoProfile.handle) {
    await claimHandle(supabase, demoProfile.id, DEMO_PROFILE.handle);
  }

  const { data: ownedProfiles } = await supabase
    .from("artist_profiles")
    .select("id, artists(demo_kind)")
    .eq("owner_user_id", userId);
  const realProfiles = (ownedProfiles ?? []).filter((row) => {
    const artist = row.artists as
      | { demo_kind?: string | null }
      | { demo_kind?: string | null }[]
      | null;
    const kind = Array.isArray(artist) ? artist[0]?.demo_kind : artist?.demo_kind;
    return kind == null;
  });
  if (!realProfiles.length) return;

  const rows = realProfiles.flatMap((real) => [
    {
      follower_profile_id: real.id,
      followee_profile_id: demoProfile.id,
    },
    {
      follower_profile_id: demoProfile.id,
      followee_profile_id: real.id,
    },
  ]);

  const { error } = await supabase.from("profile_follows").upsert(rows, {
    onConflict: "follower_profile_id,followee_profile_id",
    ignoreDuplicates: true,
  });
  if (error) {
    // Trigger silently skipping still returns no error; a real failure should
    // not take down Social or demo status checks.
    console.warn("[demo] ensureOwnerDemoMutualFollows:", error.message);
  }
}

/**
 * Seeds the demo. Safe to call twice: a current demo is returned untouched,
 * while an older version is removed and rebuilt from the latest shared data.
 */
export async function seedPresidentDemo(supabase: Client): Promise<SeedResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in first.");

  const existing = await findDemoArtist(supabase);
  if (existing && existing.demoKind !== PRESIDENT_DEMO_KIND) {
    await removeDemo(supabase, existing.artistId);
  } else if (existing) {
    const inspection = await inspectDemoWorkspace(supabase, existing.artistId);
    if (!inspection.ready) {
      // Serverless timeouts can end the request before buildWorkspace reaches
      // its catch block. Remove only the row explicitly marked as demo, then
      // rebuild cleanly instead of reopening a permanently partial catalog.
      await removeDemo(supabase, existing.artistId);
    } else {
      await ensureOwnerDemoMutualFollows(supabase, existing.artistId).catch(
        () => {}
      );
      return {
        ...existing,
        alreadyExisted: true,
        spaceId: inspection.spaceId,
        counts: {
          tracks: 0,
          projects: 0,
          tasks: 0,
          sessions: 0,
          feedback: 0,
          events: 0,
          spotifyLinked: 0,
        },
      };
    }
  }

  // sort = -1 puts the demo first in the rail, which also means the workspace
  // gate in app/(app)/layout.tsx reads *its* origin_status. Marked complete so
  // a member who tries the demo mid-Origin isn't bounced back into onboarding
  // while they look around. Deleting the demo hands that role straight back to
  // their own artist, unfinished Origin and all.
  const { data: artist, error: artistError } = await supabase
    .from("artists")
    .insert({
      name: DEMO_PROFILE.displayName,
      palette_id: DEMO_PROFILE.paletteId,
      sort: -1,
      demo_kind: PRESIDENT_DEMO_KIND,
      origin_status: "legacy_complete",
      logo_url: PRESIDENT_DEMO_LOGO_URL,
      emblem_url: PRESIDENT_DEMO_PROFILE_URL,
      banner_url: "/demo/president/banner.jpg",
    })
    .select("id, name, demo_kind")
    .single();
  if (artistError || !artist) {
    throw new Error(
      artistError?.message?.includes("demo_kind")
        ? "The demo needs migration 073 — run it in Supabase first."
        : artistError?.message ?? "Couldn't create the demo artist."
    );
  }

  // From here on, anything that fails leaves a half-built demo. Rather than
  // trying to unwind row by row, drop the artist — the cascade takes the whole
  // thing with it and the member can just press the button again.
  try {
    return await buildWorkspace(supabase, artist.id);
  } catch (err) {
    await removeDemo(supabase, artist.id).catch(() => {});
    throw err;
  }
}

async function buildWorkspace(
  supabase: Client,
  artistId: string
): Promise<SeedResult> {
  const fail = (label: string, error: { message?: string } | null) => {
    if (error) throw new Error(`${label}: ${error.message ?? "unknown error"}`);
  };
  const userId = (await supabase.auth.getUser()).data.user!.id;

  // ---------- Spaces and stages ----------
  const spaceIds = new Map<string, string>();
  const stageIds = new Map<string, string>(); // `${spaceRef}:${stageName}`

  for (let index = 0; index < DEMO_SPACES.length; index += 1) {
    const space = DEMO_SPACES[index];
    const { data, error } = await supabase
      .from("spaces")
      .insert({ artist_id: artistId, name: space.name, sort: index, focus: space.focus })
      .select("id")
      .single();
    fail("space", error);
    spaceIds.set(space.ref, data!.id);

    // Only a music-focus space has a board, so only it gets a pipeline.
    if (space.focus !== "music") continue;
    const stageRows = DEMO_STAGES.map((name, sort) => ({
      space_id: data!.id,
      name,
      sort,
    }));
    const { data: stages, error: stageError } = await supabase
      .from("stages")
      .insert(stageRows)
      .select("id, name");
    fail("stages", stageError);
    for (const stage of stages ?? []) {
      stageIds.set(`${space.ref}:${stage.name}`, stage.id);
    }
  }

  // ---------- Projects ----------
  const projectIds = new Map<string, string>();
  for (const project of DEMO_PROJECTS) {
    const { data, error } = await supabase
      .from("projects")
      .insert({
        space_id: spaceIds.get(project.spaceRef),
        name: project.name,
        description: project.description,
        deadline: project.deadline,
        project_type: project.projectType,
      })
      .select("id")
      .single();
    fail("project", error);
    projectIds.set(project.ref, data!.id);
  }

  // ---------- Track groups ----------
  const groupIds = new Map<string, string>();
  for (let index = 0; index < DEMO_TRACK_GROUPS.length; index += 1) {
    const group = DEMO_TRACK_GROUPS[index];
    const { data, error } = await supabase
      .from("track_groups")
      .insert({
        user_id: userId,
        space_id: spaceIds.get("originals"),
        name: group.name,
        sort: index,
      })
      .select("id")
      .single();
    fail("track group", error);
    for (const ref of group.trackRefs) groupIds.set(ref, data!.id);
  }

  // ---------- Tracks ----------
  const trackIds = new Map<string, string>();
  const trackRows = DEMO_TRACKS.map((track) => ({
    space_id: spaceIds.get("originals"),
    project_id: track.projectRef ? projectIds.get(track.projectRef) : null,
    stage_id: stageIds.get(`originals:${track.stage}`) ?? null,
    list_group_id: groupIds.get(track.ref) ?? null,
    title: track.title,
    type: "original",
    bpm: track.bpm,
    musical_key: track.musicalKey,
    genre: track.genre,
    deadline: track.deadline ?? null,
    momentum: track.momentum,
    tags: track.tags,
    notes: track.notes,
    next_action: track.nextAction,
    next_action_due: track.nextActionDue,
    blocked_reason: track.blockedReason ?? null,
    waiting_on: track.waitingOn ?? null,
    spotify_track_number: track.trackNumber,
    spotify_release_date: track.releasedOn,
    spotify_release_date_precision: track.releasedOn ? "day" : null,
    spotify_duration_ms: track.durationSec ? track.durationSec * 1000 : null,
    spotify_artist_names: [DEMO_PROFILE.displayName],
  }));

  const { data: tracks, error: trackError } = await supabase
    .from("tracks")
    .insert(trackRows)
    .select("id, title");
  fail("tracks", trackError);
  // insert() returns rows in the order they were sent, but match on title so a
  // future reorder can't silently mis-link checklists and sessions.
  for (const track of DEMO_TRACKS) {
    const row = (tracks ?? []).find((t) => t.title === track.title);
    if (row) trackIds.set(track.ref, row.id);
  }

  // ---------- Checklists ----------
  const checklistRows = DEMO_TRACKS.flatMap((track) =>
    (track.checklist ?? []).map((item, sort) => ({
      track_id: trackIds.get(track.ref),
      text: item.text,
      done: item.done,
      sort,
    }))
  ).filter((row) => row.track_id);
  if (checklistRows.length) {
    const { error } = await supabase.from("checklist_items").insert(checklistRows);
    fail("checklist", error);
  }

  // ---------- Tasks ----------
  const taskRows = DEMO_TASKS.map((task) => ({
    space_id: spaceIds.get(task.spaceRef),
    project_id: task.projectRef ? projectIds.get(task.projectRef) : null,
    track_id: task.trackRef ? trackIds.get(task.trackRef) ?? null : null,
    title: task.title,
    category: task.category,
    status: task.status,
    due_date: task.dueOffsetDays === null ? null : dateFromAlbumOffset(task.dueOffsetDays),
    notes: task.notes,
  }));
  const { error: taskError } = await supabase.from("tasks").insert(taskRows);
  fail("tasks", taskError);

  // ---------- Calendar events and shows ----------
  const eventRows = DEMO_CALENDAR_EVENTS.map((event) => ({
    user_id: userId,
    space_id: spaceIds.get(event.spaceRef),
    project_id: event.projectRef ? projectIds.get(event.projectRef) : null,
    track_id: null,
    title: event.title,
    kind: event.kind,
    description: event.description,
    location: event.location,
    all_day: false,
    start_date: null,
    end_date: null,
    starts_at: event.startsAt,
    ends_at: event.endsAt,
    timezone: event.timezone,
  }));
  const { error: eventError } = await supabase.from("calendar_events").insert(eventRows);
  fail("calendar events", eventError);

  // ---------- Focus sessions ----------
  const sessionRows = DEMO_SESSIONS.map((session) => {
    const startedAt = isoDaysAgo(session.daysAgo, session.startHour);
    const endedAt = new Date(
      new Date(startedAt).getTime() + session.minutes * 60_000
    ).toISOString();
    return {
      user_id: userId,
      track_id: trackIds.get(session.trackRef),
      note: session.note,
      goal: session.goal,
      outcome: session.outcome,
      status: "completed" as const,
      started_at: startedAt,
      ended_at: endedAt,
      elapsed_sec: session.minutes * 60,
      logged_at: endedAt,
    };
  }).filter((row) => row.track_id);
  const { error: sessionError } = await supabase.from("sessions").insert(sessionRows);
  fail("sessions", sessionError);

  // ---------- Guest feedback ----------
  const feedbackRows = DEMO_FEEDBACK.map((item) => ({
    track_id: trackIds.get(item.trackRef),
    reviewer: item.reviewer,
    text: item.text,
    status: item.status,
    received_at: isoDaysAgo(item.daysAgo, 9),
  })).filter((row) => row.track_id);
  const { error: feedbackError } = await supabase.from("feedback").insert(feedbackRows);
  fail("feedback", feedbackError);

  // ---------- Board notes ----------
  const noteRows = DEMO_BOARD_NOTES.map((note, sort) => ({
    user_id: userId,
    space_id: spaceIds.get("originals"),
    stage_id: stageIds.get(`originals:${note.stage}`),
    title: note.title,
    body: note.body,
    sort,
  })).filter((row) => row.stage_id);
  if (noteRows.length) {
    const { error } = await supabase.from("board_notes").insert(noteRows);
    fail("board notes", error);
  }

  // Real Spotify ids, so the released songs actually play. Last, and never
  // fatal — a demo with silent tracks is worth far more than no demo.
  const enriched = await enrichFromSpotify(supabase, trackIds).catch(() => 0);

  // The Artist page is the last thing built: it's the only part that can fail
  // for a reason outside this account's control (a handle someone else took),
  // and it must never cost the member the catalog they came to look at.
  await seedProfile(supabase, artistId).catch(() => {});
  // After the demo profile exists, put it on the owner's Social graph so they
  // can open it from Follows without publishing it to anyone else.
  await ensureOwnerDemoMutualFollows(supabase, artistId).catch(() => {});

  return {
    artistId,
    demoKind: PRESIDENT_DEMO_KIND,
    name: DEMO_PROFILE.displayName,
    alreadyExisted: false,
    spaceId: spaceIds.get("originals") ?? "",
    counts: {
      tracks: trackIds.size,
      projects: projectIds.size,
      tasks: taskRows.length,
      sessions: sessionRows.length,
      feedback: feedbackRows.length,
      events: eventRows.length,
      spotifyLinked: enriched,
    },
  };
}

/**
 * Deletes the demo artist and everything hanging off it.
 *
 * Most of the catalog goes by cascade from `artists`. Projects are the
 * exception — `projects.space_id` is ON DELETE SET NULL, so dropping the spaces
 * would leave orphaned demo projects sitting in the member's Projects page
 * forever. They're removed explicitly, first.
 *
 * Refuses to touch an artist that isn't marked as a demo, so a bad id from a
 * client can't delete real work.
 */
export async function removeDemo(supabase: Client, artistId: string): Promise<void> {
  const { data: artist, error } = await supabase
    .from("artists")
    .select("id, demo_kind")
    .eq("id", artistId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!artist) return;
  if (!artist.demo_kind) throw new Error("That artist isn't demo data.");

  const { data: spaces } = await supabase
    .from("spaces")
    .select("id")
    .eq("artist_id", artistId);
  const spaceIds = (spaces ?? []).map((s) => s.id);

  if (spaceIds.length) {
    const { error: projectError } = await supabase
      .from("projects")
      .delete()
      .in("space_id", spaceIds);
    if (projectError) throw new Error(projectError.message);
  }

  const { error: deleteError } = await supabase
    .from("artists")
    .delete()
    .eq("id", artistId);
  if (deleteError) throw new Error(deleteError.message);
}
