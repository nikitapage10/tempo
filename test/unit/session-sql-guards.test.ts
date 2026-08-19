import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("Session SQL guards", () => {
  it("keeps Session chats out of ad-hoc artist groups", () => {
    const sql = read("migrations/114_sessions_core.sql");
    expect(sql).toContain("create or replace function is_artist_group_conversation");
    expect(sql).toContain("and c.session_room_id is null");
  });

  it("notifies members of guest messages with is distinct from", () => {
    const sql = read("migrations/115_sessions_guests.sql");
    expect(sql).toContain("is distinct from");
    expect(sql).toContain("sender_session_guest_id");
  });

  it("snapshots the focused song and current bounce for each instance", () => {
    const sql = read("migrations/116_session_track_focus.sql");
    expect(sql).toContain("add column if not exists track_id");
    expect(sql).toContain("add column if not exists version_id");
    expect(sql).toContain("where track_id = v_track and is_current = true");
    expect(sql).toContain("values (p_room, auth.uid(), v_track, v_version)");
  });

  it("keeps transcripts private to active Session members", () => {
    const sql = read("migrations/118_session_transcripts.sql");
    expect(sql).toContain("alter table session_transcript_lines enable row level security");
    expect(sql).toContain("member.user_id = auth.uid()");
    expect(sql).toContain("speaker_user_id = auth.uid()");
    expect(sql).toContain("meet.notes_enabled = true");
    expect(sql).toContain("add column if not exists audio_seconds");
  });
});
