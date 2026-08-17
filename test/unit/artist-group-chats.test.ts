import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("artist group chats", () => {
  it("creates groups through a guarded RPC that reuses the DM policy", () => {
    const sql = read("migrations/111_artist_group_chats.sql");
    expect(sql).toContain("create or replace function start_group_conversation");
    expect(sql).toContain("can_dm_profile(v_member)");
    expect(sql).toContain("is_artist_group_conversation");
    expect(sql).toContain("with check (false)");
    expect(sql).toContain("and left_at is null");
    expect(sql).toContain("v_scene is not null");
  });

  it("lets New message start a group without mixing it into Teams", () => {
    const panel = read("components/messages/new-conversation-panel.tsx");
    const inbox = read("app/(app)/messages/messages-view.tsx");
    const api = read("lib/api/messages.ts");
    expect(panel).toContain('setMode("group")');
    expect(panel).toContain("startGroup.mutateAsync");
    expect(inbox).toContain("Groups");
    expect(inbox).toContain("Start a group from New message.");
    expect(inbox).toContain("isArtistGroupConversation");
    expect(api).toContain("start_group_conversation");
    expect(api).toContain("isMessagesInboxConversation");
  });
});
