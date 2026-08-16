import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Nikita welcome inbox visibility", () => {
  const migration = readFileSync(
    join(process.cwd(), "migrations/080_hide_unanswered_nikita_welcomes.sql"),
    "utf8"
  );
  const messagesApi = readFileSync(
    join(process.cwd(), "lib/api/messages.ts"),
    "utf8"
  );
  const messagesView = readFileSync(
    join(process.cwd(), "app/(app)/messages/messages-view.tsx"),
    "utf8"
  );

  it("hides the automated welcome sender until another user replies", () => {
    expect(migration).toContain("archived_at = 'infinity'::timestamptz");
    expect(migration).toContain("user_id = new.sender_user_id");
    expect(migration).toContain("reply.sender_user_id <> welcome.sender_user_id");
  });

  it("keeps the hidden sentinel out of the Archived inbox", () => {
    expect(messagesApi).toContain('.neq("archived_at", "infinity")');
  });

  it("resolves direct-message identity by account when the active workspace changes", () => {
    expect(messagesApi).toContain("conversation_id, profile_id, user_id, profile:artist_profiles");
    expect(messagesApi).toContain("p.user_id !== user.id");
    expect(messagesApi).toContain('.neq("sender_user_id", user.id)');
    expect(messagesApi).not.toContain("p.profile_id !== myProfileId");
    expect(messagesView).toContain("message.sender_user_id === currentUser?.id");
    expect(messagesView).not.toContain("message.sender_profile_id === myProfileId");
  });
});
