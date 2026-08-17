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
});
