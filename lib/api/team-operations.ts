import { createClient } from "@/lib/supabase/client";
import { normalizeAreas, type AreaGrants } from "@/lib/team/areas";

export type EffectiveArtistAccess = {
  artistId: string;
  userId: string;
  areas: AreaGrants;
  isOwner: boolean;
  isActiveMember: boolean;
  isSuspended: boolean;
  status: string;
};

export type MyWorkItem = {
  kind: "task" | "comment" | "review";
  sourceId: string;
  artistId: string;
  artistName: string;
  artistEmblemPath: string | null;
  spaceId: string;
  title: string;
  context: string;
  dueAt: string | null;
  urgency: "overdue" | "today" | "review_requested" | "upcoming" | "open";
  primaryAction: string;
  href: string;
  updatedAt: string;
};

export type TeamBrief = {
  brief: {
    artist_id?: string;
    welcome_note?: string | null;
    working_norms?: string | null;
    timezone?: string | null;
    working_rhythm?: string | null;
    brief_version?: number;
    updated_at?: string;
  };
  links: { id: string; label: string; url: string; sort: number }[];
  pins: {
    id: string;
    track_id?: string | null;
    project_id?: string | null;
    task_id?: string | null;
    calendar_event_id?: string | null;
    note?: string | null;
    sort: number;
  }[];
  access: unknown;
};

export type ProAvailability = {
  status: "available" | "limited" | "unavailable";
  untilDate: string | null;
  note: string;
  timezone: string;
  workingDays: number[];
  shareWithTeams: boolean;
};

export type ProScheduleItem = {
  eventId: string;
  artistId: string;
  artistName: string;
  spaceId: string;
  title: string;
  kind: string;
  allDay: boolean;
  startDate: string | null;
  endDate: string | null;
  startsAt: string | null;
  endsAt: string | null;
  timezone: string | null;
  href: string;
};

export type StarterKitPreview = {
  primary_lens: string;
  include_samples: boolean;
  count: number;
  items: { content_key: string; kind: string; payload: Record<string, unknown> }[];
};

function missingTeamOperations(error: { message?: string } | null): boolean {
  return /schema cache|does not exist|could not find the function|team_brief|my_work_inbox|pro_availability/i.test(
    error?.message ?? ""
  );
}

export async function fetchEffectiveArtistAccess(
  artistId: string,
  userId?: string
): Promise<EffectiveArtistAccess | null> {
  const { data, error } = await createClient().rpc("effective_artist_access", {
    p_artist_id: artistId,
    ...(userId ? { p_user_id: userId } : {}),
  });
  if (error) {
    if (missingTeamOperations(error)) return null;
    throw error;
  }
  const row = data as Record<string, unknown>;
  return {
    artistId: String(row.artist_id),
    userId: String(row.user_id),
    areas: normalizeAreas(row.areas),
    isOwner: row.is_owner === true,
    isActiveMember: row.is_active_member === true,
    isSuspended: row.is_suspended === true,
    status: String(row.status ?? "none"),
  };
}

export async function fetchMyWork(filters?: {
  artistId?: string | null;
  kind?: "task" | "comment" | "review" | null;
  state?: "open" | "completed";
}): Promise<MyWorkItem[]> {
  const { data, error } = await createClient().rpc("my_work_inbox", {
    p_artist_id: filters?.artistId ?? null,
    p_kind: filters?.kind ?? null,
    p_state: filters?.state ?? "open",
    p_limit: 100,
  });
  if (error) {
    if (missingTeamOperations(error)) return [];
    throw error;
  }
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    kind: row.kind as MyWorkItem["kind"],
    sourceId: String(row.source_id),
    artistId: String(row.artist_id),
    artistName: String(row.artist_name),
    artistEmblemPath: typeof row.artist_emblem_path === "string" ? row.artist_emblem_path : null,
    spaceId: String(row.space_id),
    title: String(row.title),
    context: String(row.context ?? ""),
    dueAt: typeof row.due_at === "string" ? row.due_at : null,
    urgency: row.urgency as MyWorkItem["urgency"],
    primaryAction: String(row.primary_action),
    href: String(row.href),
    updatedAt: String(row.updated_at),
  }));
}

export async function setAssignedTaskStatus(
  taskId: string,
  status: "todo" | "doing" | "done"
): Promise<void> {
  const { error } = await createClient().rpc("set_assigned_task_status", {
    p_task_id: taskId,
    p_status: status,
  });
  if (error) throw error;
}

export async function completeReviewRequest(
  requestId: string,
  result: "approved" | "changes_requested" | "responded" | "complete_without_response" | "ready" | "not_ready"
): Promise<void> {
  const { error } = await createClient().rpc("complete_review_request", {
    p_request_id: requestId,
    p_result_type: result,
  });
  if (error) throw error;
}

export async function resolveAssignedComment(commentId: string): Promise<void> {
  const { error } = await createClient().rpc("set_assigned_comment_resolved", {
    p_comment_id: commentId,
    p_resolved: true,
  });
  if (error) throw error;
}

export async function assignArtistTask(taskId: string, userId: string | null): Promise<void> {
  const { error } = await createClient().rpc("assign_artist_task", {
    p_task_id: taskId,
    p_assignee_user_id: userId,
  });
  if (error) throw error;
}

export async function fetchTeamBrief(artistId: string): Promise<TeamBrief | null> {
  const { data, error } = await createClient().rpc("artist_team_brief_read", {
    p_artist_id: artistId,
  });
  if (error) {
    if (missingTeamOperations(error)) return null;
    throw error;
  }
  return data as TeamBrief;
}

export async function saveTeamBrief(
  artistId: string,
  brief: Pick<TeamBrief["brief"], "welcome_note" | "working_norms" | "timezone" | "working_rhythm">
): Promise<void> {
  const { error } = await createClient()
    .from("artist_team_briefs")
    .upsert({ artist_id: artistId, ...brief }, { onConflict: "artist_id" });
  if (error) throw error;
}

export async function markTeamBriefSeen(artistId: string, version: number): Promise<void> {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  const { error } = await supabase.from("artist_team_brief_seen").upsert({
    user_id: data.user.id,
    artist_id: artistId,
    last_seen_version: version,
    updated_at: new Date().toISOString(),
  });
  if (error && !missingTeamOperations(error)) throw error;
}

export async function ensureArtistTeamRoom(artistId: string): Promise<string> {
  const { data, error } = await createClient().rpc("ensure_artist_team_room", {
    p_artist_id: artistId,
  });
  if (error) throw error;
  return String(data);
}

export async function fetchProAvailability(): Promise<ProAvailability> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in required.");
  const { data, error } = await supabase.from("pro_availability").select("*").eq("user_id", auth.user.id).maybeSingle();
  if (error && !missingTeamOperations(error)) throw error;
  return {
    status: (data?.status as ProAvailability["status"]) ?? "available",
    untilDate: data?.until_date ?? null,
    note: data?.note ?? "",
    timezone: data?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    workingDays: data?.working_days ?? [1, 2, 3, 4, 5],
    shareWithTeams: data?.share_with_teams ?? false,
  };
}

export async function saveProAvailability(value: ProAvailability): Promise<void> {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Sign in required.");
  const { error } = await supabase.from("pro_availability").upsert({
    user_id: data.user.id,
    status: value.status,
    until_date: value.untilDate || null,
    note: value.note.trim() || null,
    timezone: value.timezone || null,
    working_days: value.workingDays,
    share_with_teams: value.shareWithTeams,
  });
  if (error) throw error;
}

export async function fetchProSchedule(from: Date, to: Date): Promise<ProScheduleItem[]> {
  const { data, error } = await createClient().rpc("my_artist_schedule", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  if (error) {
    if (missingTeamOperations(error)) return [];
    throw error;
  }
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    eventId: String(row.event_id), artistId: String(row.artist_id), artistName: String(row.artist_name),
    spaceId: String(row.space_id), title: String(row.title), kind: String(row.kind), allDay: row.all_day === true,
    startDate: typeof row.start_date === "string" ? row.start_date : null,
    endDate: typeof row.end_date === "string" ? row.end_date : null,
    startsAt: typeof row.starts_at === "string" ? row.starts_at : null,
    endsAt: typeof row.ends_at === "string" ? row.ends_at : null,
    timezone: typeof row.timezone === "string" ? row.timezone : null, href: String(row.href),
  }));
}

export async function previewStarterKits(
  keys: string[], primaryLens: string, includeSamples: boolean
): Promise<StarterKitPreview> {
  const { data, error } = await createClient().rpc("preview_pro_starter_kits", {
    p_kit_keys: keys, p_primary_lens: primaryLens, p_include_samples: includeSamples,
  });
  if (error) throw error;
  return data as StarterKitPreview;
}

export async function installStarterKits(
  keys: string[], primaryLens: string, includeSamples: boolean, requestId: string
): Promise<{ added: number; already_present: number; skipped: number }> {
  const { data, error } = await createClient().rpc("install_pro_starter_kits", {
    p_kit_keys: keys, p_primary_lens: primaryLens, p_include_samples: includeSamples, p_request_id: requestId,
  });
  if (error) throw error;
  return data as { added: number; already_present: number; skipped: number };
}
