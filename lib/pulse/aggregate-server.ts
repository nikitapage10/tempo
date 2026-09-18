import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppNotification } from "@/lib/types";
import type { RawPulseItem } from "./normalize";
import {
  buildAttentionItems,
  buildCalendarItems,
  buildDueItems,
  buildNotificationItems,
  buildProgressItems,
  filterItemsByPreferences,
  type PulseCategoryPreferences,
  type PulseDigestKind,
  type PulseEvent,
  type PulseTask,
  type PulseTrack,
} from "./sources";

/**
 * Server-side Pulse aggregation for a single user, re-authorized at
 * generation time.
 *
 * This runs with the service-role client, which ignores row-level security,
 * so nothing here may lean on RLS to keep workspaces apart. Reads are scoped
 * two ways, deliberately narrower than what the member could open in the app:
 *
 *   1. Spaces belonging to artists this user *owns*. A workspace shared with
 *      them as a team member is left out — being allowed to open someone
 *      else's calendar is not the same as consenting to have it mailed to you
 *      by a background job, and their owner gets that digest already.
 *   2. Tasks assigned directly to this user, wherever they live. Those were
 *      handed to them by name.
 *
 * Demo workspaces are excluded: nobody should be emailed a deadline that
 * belongs to a sample artist.
 */

const HORIZON_DAYS: Record<PulseDigestKind, number> = {
  daily_digest: 2,
  weekly_digest: 7,
};
const ROW_LIMIT = 200;

export type PulseAggregateOptions = {
  kind: PulseDigestKind;
  preferences: PulseCategoryPreferences;
  timezone?: string;
  now?: Date;
};

function missingDemoKind(error: { code?: string; message?: string } | null) {
  return !!error && (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    error.message?.includes("demo_kind") === true
  );
}

/** Spaces the member owns outright, with demo workspaces left out. */
async function ownedSpaceIds(admin: SupabaseClient, userId: string): Promise<string[]> {
  let artists: { id: string }[] | null = null;
  const filtered = await admin
    .from("artists")
    .select("id")
    .eq("user_id", userId)
    .is("demo_kind", null);
  if (filtered.error && !missingDemoKind(filtered.error)) return [];
  if (!filtered.error) {
    artists = filtered.data as { id: string }[] | null;
  } else {
    // Pre-073 database: no demo feature exists, so every artist is real.
    const fallback = await admin.from("artists").select("id").eq("user_id", userId);
    if (fallback.error) return [];
    artists = fallback.data as { id: string }[] | null;
  }

  const artistIds = (artists ?? []).map((artist) => artist.id);
  if (!artistIds.length) return [];
  const { data: spaces, error } = await admin
    .from("spaces")
    .select("id")
    .in("artist_id", artistIds);
  if (error) return [];
  return (spaces ?? []).map((space) => space.id as string);
}

async function fetchTasks(
  admin: SupabaseClient,
  userId: string,
  spaceIds: string[]
): Promise<PulseTask[]> {
  const byId = new Map<string, PulseTask>();
  const collect = (rows: PulseTask[] | null) => {
    for (const row of rows ?? []) byId.set(row.id, row);
  };

  if (spaceIds.length) {
    const { data } = await admin
      .from("tasks")
      .select("id, title, due_date, status")
      .in("space_id", spaceIds)
      .neq("status", "done")
      .not("due_date", "is", null)
      .limit(ROW_LIMIT);
    collect(data as PulseTask[] | null);
  }

  const { data: assigned } = await admin
    .from("tasks")
    .select("id, title, due_date, status")
    .eq("assigned_to_user_id", userId)
    .neq("status", "done")
    .not("due_date", "is", null)
    .limit(ROW_LIMIT);
  collect(assigned as PulseTask[] | null);

  return Array.from(byId.values());
}

/**
 * Most recent logged session per track. Without it the attention rules treat
 * every track as never worked on and flag the whole catalog.
 */
async function lastSessionByTrack(
  admin: SupabaseClient,
  trackIds: string[]
): Promise<Map<string, string | null>> {
  const latest = new Map<string, string | null>();
  if (!trackIds.length) return latest;
  const { data } = await admin
    .from("sessions")
    .select("track_id, logged_at")
    .in("track_id", trackIds)
    .order("logged_at", { ascending: false })
    .limit(ROW_LIMIT * 5);
  for (const row of data ?? []) {
    const trackId = row.track_id as string;
    if (!latest.has(trackId)) latest.set(trackId, row.logged_at as string);
  }
  return latest;
}

async function fetchWeeklyProgress(admin: SupabaseClient, spaceIds: string[], since: string) {
  if (!spaceIds.length) return { tasksCompleted: 0, versionsUploaded: 0, sessionsLogged: 0 };

  const { data: trackRows } = await admin
    .from("tracks")
    .select("id")
    .in("space_id", spaceIds)
    .limit(ROW_LIMIT * 5);
  const trackIds = (trackRows ?? []).map((track) => track.id as string);

  const [tasks, versions, sessions] = await Promise.all([
    admin
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .in("space_id", spaceIds)
      .gte("completed_at", since),
    trackIds.length
      ? admin
          .from("versions")
          .select("id", { count: "exact", head: true })
          .in("track_id", trackIds)
          .gte("created_at", since)
      : Promise.resolve({ count: 0 }),
    trackIds.length
      ? admin
          .from("sessions")
          .select("id", { count: "exact", head: true })
          .in("track_id", trackIds)
          .gte("logged_at", since)
      : Promise.resolve({ count: 0 }),
  ]);

  return {
    tasksCompleted: tasks.count ?? 0,
    versionsUploaded: versions.count ?? 0,
    sessionsLogged: sessions.count ?? 0,
  };
}

export async function aggregatePulseItemsForUser(
  admin: SupabaseClient,
  userId: string,
  options: PulseAggregateOptions
): Promise<RawPulseItem[]> {
  const now = options.now ?? new Date();
  const timezone = options.timezone || "UTC";
  const horizonDays = HORIZON_DAYS[options.kind];
  const spaceIds = await ownedSpaceIds(admin, userId);

  const [notifications, tasks, tracks, events] = await Promise.all([
    admin
      .from("notifications")
      .select("id, type, entity_type, entity_id, link_url, track_id, read_at, created_at")
      .eq("user_id", userId)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(ROW_LIMIT),
    fetchTasks(admin, userId, spaceIds),
    spaceIds.length
      ? admin
          .from("tracks")
          .select(
            "id, title, momentum, deadline, next_action, next_action_due, blocked_reason, waiting_on, stage_entered_at"
          )
          .in("space_id", spaceIds)
          .limit(ROW_LIMIT)
      : Promise.resolve({ data: [] }),
    spaceIds.length
      ? admin
          .from("calendar_events")
          .select("id, title, starts_at, start_date")
          .in("space_id", spaceIds)
          .limit(ROW_LIMIT)
      : Promise.resolve({ data: [] }),
  ]);

  const trackRows = (tracks.data ?? []) as PulseTrack[];
  const sessions = await lastSessionByTrack(admin, trackRows.map((track) => track.id));

  const items: RawPulseItem[] = [
    ...buildNotificationItems((notifications.data ?? []) as AppNotification[]),
    ...buildDueItems(tasks, now, timezone, horizonDays),
    ...buildAttentionItems(trackRows, sessions, now),
    ...buildCalendarItems((events.data ?? []) as PulseEvent[], now, horizonDays),
  ];

  if (options.kind === "weekly_digest") {
    const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    items.push(...buildProgressItems(await fetchWeeklyProgress(admin, spaceIds, since), now));
  }

  return filterItemsByPreferences(items, options.preferences, options.kind);
}
