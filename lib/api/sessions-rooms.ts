import { createClient } from "@/lib/supabase/client";
import type {
  SessionAgendaItem,
  SessionAttendance,
  SessionDecision,
  SessionMeet,
  SessionPinSummary,
  SessionRoom,
  SessionRoomMember,
  SessionRoomStatus,
  Task,
} from "@/lib/types";

export function isMissingSessionSchema(error: { message?: string }): boolean {
  return /\bsession_room/i.test(error?.message ?? "") || /\bsession_members\b/i.test(error?.message ?? "");
}

export async function checkSessionRoomsSchemaReady(): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("session_rooms").select("id").limit(1);
  if (error) {
    if (isMissingSessionSchema(error)) return false;
    throw error;
  }
  return true;
}

type MemberRow = {
  user_id: string;
  profile_id: string;
  role: SessionRoomMember["role"];
  status: SessionRoomMember["status"];
  profile: {
    display_name: string | null;
    emblem_url: string | null;
    palette_id: string | null;
    ice_color: string | null;
    amber_color: string | null;
  } | null;
};

function mapMember(row: MemberRow): SessionRoomMember {
  return {
    user_id: row.user_id,
    profile_id: row.profile_id,
    role: row.role,
    status: row.status,
    display_name: row.profile?.display_name?.trim() || "Member",
    emblem_url: row.profile?.emblem_url ?? null,
    palette_id: row.profile?.palette_id ?? null,
    ice_color: row.profile?.ice_color ?? null,
    amber_color: row.profile?.amber_color ?? null,
  };
}

async function attachRoomExtras(
  rooms: Array<Record<string, unknown> & { id: string }>
): Promise<SessionRoom[]> {
  if (!rooms.length) return [];
  const supabase = createClient();
  const ids = rooms.map((room) => room.id);

  const [membersRes, agendaRes, tasksRes, convosRes, meetsRes] = await Promise.all([
    supabase
      .from("session_members")
      .select(
        "session_room_id, user_id, profile_id, role, status, profile:artist_profiles(display_name, emblem_url, palette_id, ice_color, amber_color)"
      )
      .in("session_room_id", ids)
      .eq("status", "active"),
    supabase
      .from("session_agenda_items")
      .select("session_room_id, done_at")
      .in("session_room_id", ids),
    supabase.from("session_tasks").select("session_room_id").in("session_room_id", ids),
    supabase.from("conversations").select("id, session_room_id").in("session_room_id", ids),
    supabase
      .from("session_meets")
      .select("id, session_room_id, started_at")
      .in("session_room_id", ids)
      .is("ended_at", null),
  ]);

  const membersByRoom = new Map<string, SessionRoomMember[]>();
  for (const raw of membersRes.data ?? []) {
    const row = raw as unknown as MemberRow & { session_room_id: string };
    const nested = raw as { profile?: MemberRow["profile"] | MemberRow["profile"][] };
    const profile = Array.isArray(nested.profile) ? nested.profile[0] ?? null : nested.profile ?? null;
    const list = membersByRoom.get(row.session_room_id) ?? [];
    list.push(mapMember({ ...row, profile }));
    membersByRoom.set(row.session_room_id, list);
  }
  const openAgenda = new Map<string, number>();
  for (const row of agendaRes.data ?? []) {
    if (row.done_at) continue;
    openAgenda.set(row.session_room_id, (openAgenda.get(row.session_room_id) ?? 0) + 1);
  }
  const taskCount = new Map<string, number>();
  for (const row of tasksRes.data ?? []) {
    taskCount.set(row.session_room_id, (taskCount.get(row.session_room_id) ?? 0) + 1);
  }
  const convoByRoom = new Map(
    (convosRes.data ?? []).map((row) => [row.session_room_id as string, row.id as string])
  );
  const meetByRoom = new Map(
    (meetsRes.data ?? []).map((row) => [row.session_room_id as string, row.id as string])
  );
  const meetStartedByRoom = new Map(
    (meetsRes.data ?? []).map((row) => [
      row.session_room_id as string,
      (row.started_at as string | null) ?? null,
    ])
  );

  return rooms.map((room) => ({
    id: room.id,
    artist_id: room.artist_id as string,
    space_id: room.space_id as string,
    title: room.title as string,
    purpose: (room.purpose as string) ?? "",
    status: room.status as SessionRoomStatus,
    notes: (room.notes as string) ?? "",
    notes_updated_at: (room.notes_updated_at as string | null) ?? null,
    notes_updated_by_user_id: (room.notes_updated_by_user_id as string | null) ?? null,
    created_by_user_id: room.created_by_user_id as string,
    last_hang_at: (room.last_hang_at as string | null) ?? null,
    hang_count: (room.hang_count as number) ?? 0,
    created_at: room.created_at as string,
    updated_at: room.updated_at as string,
    members: membersByRoom.get(room.id) ?? [],
    open_agenda_count: openAgenda.get(room.id) ?? 0,
    task_count: taskCount.get(room.id) ?? 0,
    conversation_id: convoByRoom.get(room.id) ?? null,
    open_meet_id: meetByRoom.get(room.id) ?? null,
    open_meet_started_at: meetStartedByRoom.get(room.id) ?? null,
  }));
}

export async function fetchSessionRooms(artistId: string): Promise<SessionRoom[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("session_rooms")
    .select("*")
    .eq("artist_id", artistId)
    .order("last_hang_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingSessionSchema(error)) return [];
    throw error;
  }
  return attachRoomExtras((data ?? []) as Array<Record<string, unknown> & { id: string }>);
}

export async function fetchSessionRoom(id: string): Promise<SessionRoom | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from("session_rooms").select("*").eq("id", id).maybeSingle();
  if (error) {
    if (isMissingSessionSchema(error)) return null;
    throw error;
  }
  if (!data) return null;
  const [room] = await attachRoomExtras([data as Record<string, unknown> & { id: string }]);
  return room ?? null;
}

export async function createSessionRoom(input: {
  artistId: string;
  spaceId: string;
  title: string;
  purpose?: string;
  memberUserIds?: string[];
}): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_session_room", {
    p_artist_id: input.artistId,
    p_space_id: input.spaceId,
    p_title: input.title,
    p_purpose: input.purpose ?? "",
  });
  if (error) throw error;
  const id = data as string;
  for (const userId of input.memberUserIds ?? []) {
    const { error: addError } = await supabase.rpc("add_session_member", {
      p_room: id,
      p_user_id: userId,
      p_role: "member",
    });
    if (addError) throw addError;
  }
  return id;
}

export async function addSessionMember(roomId: string, userId: string, role: "host" | "member" = "member") {
  const supabase = createClient();
  const { error } = await supabase.rpc("add_session_member", {
    p_room: roomId,
    p_user_id: userId,
    p_role: role,
  });
  if (error) throw error;
}

export async function removeSessionMember(roomId: string, userId: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("remove_session_member", {
    p_room: roomId,
    p_user_id: userId,
  });
  if (error) throw error;
}

export async function leaveSession(roomId: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("leave_session", { p_room: roomId });
  if (error) throw error;
}

export async function updateSessionRoom(
  id: string,
  patch: Partial<Pick<SessionRoom, "title" | "purpose" | "status" | "notes">>
) {
  const supabase = createClient();
  const body: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() };
  if (patch.notes !== undefined) {
    const { data: auth } = await supabase.auth.getUser();
    body.notes_updated_at = new Date().toISOString();
    body.notes_updated_by_user_id = auth.user?.id ?? null;
  }
  const { error } = await supabase.from("session_rooms").update(body).eq("id", id);
  if (error) throw error;
}

export async function fetchSessionAgenda(roomId: string): Promise<SessionAgendaItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("session_agenda_items")
    .select("*")
    .eq("session_room_id", roomId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SessionAgendaItem[];
}

export async function createSessionAgendaItem(roomId: string, body: string): Promise<void> {
  const supabase = createClient();
  const { data: existing } = await supabase
    .from("session_agenda_items")
    .select("sort")
    .eq("session_room_id", roomId)
    .order("sort", { ascending: false })
    .limit(1);
  const sort = ((existing?.[0]?.sort as number | undefined) ?? -1) + 1;
  const { error } = await supabase.from("session_agenda_items").insert({
    session_room_id: roomId,
    body: body.trim(),
    sort,
  });
  if (error) throw error;
}

export async function updateSessionAgendaItem(
  id: string,
  patch: Partial<Pick<SessionAgendaItem, "body" | "sort" | "done_at" | "done_by_user_id" | "done_in_meet_id">>
) {
  const supabase = createClient();
  const { error } = await supabase.from("session_agenda_items").update(patch).eq("id", id);
  if (error) throw error;
}

export async function reorderSessionAgenda(roomId: string, orderedIds: string[]) {
  const supabase = createClient();
  await Promise.all(
    orderedIds.map((id, sort) =>
      supabase.from("session_agenda_items").update({ sort }).eq("id", id).eq("session_room_id", roomId)
    )
  );
}

export async function deleteSessionAgendaItem(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("session_agenda_items").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchSessionPins(roomId: string): Promise<SessionPinSummary[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("list_session_pin_summaries", { p_room: roomId });
  if (error) throw error;
  return (data ?? []) as SessionPinSummary[];
}

export async function createSessionPin(
  roomId: string,
  target: { trackId?: string; projectId?: string; versionId?: string; taskId?: string; note?: string }
) {
  const supabase = createClient();
  const { data: existing } = await supabase
    .from("session_pins")
    .select("sort")
    .eq("session_room_id", roomId)
    .order("sort", { ascending: false })
    .limit(1);
  const sort = ((existing?.[0]?.sort as number | undefined) ?? -1) + 1;
  const { error } = await supabase.from("session_pins").insert({
    session_room_id: roomId,
    track_id: target.trackId ?? null,
    project_id: target.projectId ?? null,
    version_id: target.versionId ?? null,
    task_id: target.taskId ?? null,
    note: target.note ?? "",
    sort,
  });
  if (error) throw error;
}

export async function deleteSessionPin(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("session_pins").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchSessionTaskIds(roomId: string): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("session_tasks")
    .select("task_id")
    .eq("session_room_id", roomId)
    .order("sort", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => row.task_id as string);
}

export async function createSessionTask(input: {
  roomId: string;
  title: string;
  assignee?: string | null;
  dueDate?: string | null;
  category?: string;
}): Promise<Task> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_session_task", {
    p_room: input.roomId,
    p_title: input.title,
    p_assignee: input.assignee ?? null,
    p_due_date: input.dueDate ?? null,
    p_category: input.category ?? "other",
  });
  if (error) throw error;
  return data as Task;
}

export async function startSessionInstance(roomId: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("start_session_hang", { p_room: roomId });
  if (error) throw error;
  return data as string;
}

export async function endSessionInstance(meetId: string, summary = "") {
  const supabase = createClient();
  const { error } = await supabase.rpc("end_session_hang", {
    p_meet_id: meetId,
    p_summary: summary,
  });
  if (error) throw error;
}

export async function upsertSessionAttendance(meetId: string, displayName = "") {
  const supabase = createClient();
  const { error } = await supabase.rpc("upsert_session_attendance", {
    p_meet_id: meetId,
    p_display_name: displayName,
  });
  if (error) throw error;
}

export async function logSessionDecision(roomId: string, body: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("log_session_decision", {
    p_room: roomId,
    p_body: body,
  });
  if (error) throw error;
  return data as string;
}

export async function fetchSessionMeets(roomId: string): Promise<SessionMeet[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("session_meets")
    .select("*")
    .eq("session_room_id", roomId)
    .order("started_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SessionMeet[];
}

export async function fetchSessionAttendance(meetIds: string[]): Promise<SessionAttendance[]> {
  if (!meetIds.length) return [];
  const supabase = createClient();
  const { data, error } = await supabase.from("session_attendance").select("*").in("session_meet_id", meetIds);
  if (error) throw error;
  return (data ?? []) as SessionAttendance[];
}

export async function fetchSessionDecisions(roomId: string): Promise<SessionDecision[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("session_decisions")
    .select("id, session_room_id, session_meet_id, message_id, created_at, created_by_user_id")
    .eq("session_room_id", roomId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  if (!rows.length) return [];
  const messageIds = rows.map((row) => row.message_id as string);
  const { data: messages } = await supabase.from("messages").select("id, body").in("id", messageIds);
  const bodyById = new Map((messages ?? []).map((message) => [message.id as string, message.body as string]));
  return rows.map((row) => ({
    id: row.id as string,
    session_room_id: row.session_room_id as string,
    session_meet_id: row.session_meet_id as string,
    message_id: row.message_id as string,
    body: bodyById.get(row.message_id as string) ?? "",
    created_at: row.created_at as string,
    created_by_user_id: row.created_by_user_id as string,
  }));
}

export async function resolveSessionConversationId(roomId: string): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id")
    .eq("session_room_id", roomId)
    .maybeSingle();
  if (error) {
    if (isMissingSessionSchema(error)) return null;
    throw error;
  }
  return data?.id ?? null;
}
