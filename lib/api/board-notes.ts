import { createClient } from "@/lib/supabase/client";
import type { BoardNote, BoardNoteInsert, BoardNoteUpdate } from "@/lib/types";

function mapNoteError(error: { message?: string; code?: string }): Error {
  const message = (error.message ?? "").trim();
  const lower = message.toLowerCase();
  if (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    lower.includes("board_notes") ||
    lower.includes("schema cache") ||
    (lower.includes("relation") && lower.includes("does not exist"))
  ) {
    return new Error(
      "Board notes need migration 020 in Supabase — run that SQL, then try again."
    );
  }
  if (lower.includes("jwt") || lower.includes("auth") || error.code === "401") {
    return new Error("You’re signed out — sign in again.");
  }
  return new Error(message || "Couldn’t update that note.");
}

function normalizeNote(row: BoardNote): BoardNote {
  return {
    ...row,
    body: row.body ?? null,
    sort: row.sort ?? 0,
  };
}

export async function fetchBoardNotes(spaceId: string): Promise<BoardNote[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("board_notes")
    .select("*")
    .eq("space_id", spaceId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    const mapped = mapNoteError(error);
    if (mapped.message.includes("migration 020")) return [];
    throw mapped;
  }
  return (data ?? []).map((row) => normalizeNote(row as BoardNote));
}

export async function createBoardNote(
  input: BoardNoteInsert
): Promise<BoardNote> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You’re signed out — sign in again.");

  const title = input.title.trim();
  if (!title) throw new Error("Give the note a title.");

  const { data, error } = await supabase
    .from("board_notes")
    .insert({
      user_id: user.id,
      space_id: input.space_id,
      stage_id: input.stage_id,
      title,
      body: input.body?.trim() || null,
      sort: input.sort ?? 0,
    })
    .select("*")
    .single();
  if (error) throw mapNoteError(error);
  return normalizeNote(data as BoardNote);
}

export async function updateBoardNote(
  id: string,
  patch: BoardNoteUpdate
): Promise<BoardNote> {
  const supabase = createClient();
  const payload: BoardNoteUpdate = {
    ...patch,
    updated_at: new Date().toISOString(),
  };
  if (patch.title != null) {
    const title = patch.title.trim();
    if (!title) throw new Error("Give the note a title.");
    payload.title = title;
  }
  if (patch.body !== undefined) {
    payload.body = patch.body?.trim() || null;
  }
  const { data, error } = await supabase
    .from("board_notes")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw mapNoteError(error);
  return normalizeNote(data as BoardNote);
}

export async function moveBoardNoteStage(
  id: string,
  stageId: string
): Promise<BoardNote> {
  return updateBoardNote(id, { stage_id: stageId });
}

export async function deleteBoardNote(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("board_notes").delete().eq("id", id);
  if (error) throw mapNoteError(error);
}
