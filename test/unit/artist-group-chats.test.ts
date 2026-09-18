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
    expect(inbox).toContain("isArtistGroupConversation");
    expect(api).toContain("start_group_conversation");
    expect(api).toContain("isMessagesInboxConversation");
  });

  it("only shows a section of the inbox once something is in it", () => {
    const inbox = read("app/(app)/messages/messages-view.tsx");
    // Five standing headings, each explaining a kind of conversation the
    // member did not have, pushed the one real thread to the bottom.
    for (const placeholder of [
      "Support tickets you submit will appear here.",
      "Team rooms appear when an artist opens one.",
      "Session chats appear when you join a room.",
      "Start a group from New message.",
    ]) {
      expect(inbox, `${placeholder} is still rendered`).not.toContain(placeholder);
    }
    for (const group of [
      "visibleSupport.length ?",
      "teamConversations.length ?",
      "sessionConversations.length ?",
      "groupConversations.length ?",
      "directConversations.length ?",
    ]) {
      expect(inbox).toContain(group);
    }
    // An inbox that is empty for real still says so, once.
    expect(inbox).toContain("inboxCount === 0");
    expect(inbox).toContain("No conversations yet.");
    expect(inbox).toContain('inboxQuery ? "No matching conversations."');
  });

  it("expands a 1:1 into a new group without replacing the original chat", () => {
    const sql = read("migrations/112_expand_direct_to_group.sql");
    const panel = read("components/messages/expand-direct-panel.tsx");
    const inbox = read("app/(app)/messages/messages-view.tsx");
    const api = read("lib/api/messages.ts");
    expect(sql).toContain("create or replace function expand_direct_conversation_to_group");
    expect(sql).toContain("p_include_history");
    expect(sql).toContain("suppress_notification");
    expect(sql).toContain("Only a 1:1 chat can become a group this way");
    expect(panel).toContain("Include messages from this chat");
    expect(panel).toContain("This 1:1 stays as it is");
    expect(panel).toContain("expandDirect.mutateAsync");
    expect(inbox).toContain("Add someone to a new group");
    expect(inbox).toContain("MESSAGES_WORKSPACE_HEIGHT_CLASS");
    expect(api).toContain("expand_direct_conversation_to_group");
  });
});
