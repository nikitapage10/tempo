import { describe, expect, it } from "vitest";
import { isMyMessage, messageAuthorLabel } from "@/lib/sessions/message-authorship";

describe("Session message authorship", () => {
  it("never treats a null sender as mine", () => {
    expect(isMyMessage({ senderUserId: null, currentUserId: "u1" })).toBe(false);
    expect(isMyMessage({ senderUserId: "u1", currentUserId: null })).toBe(false);
    expect(isMyMessage({ senderUserId: "u1", currentUserId: "u1" })).toBe(true);
  });

  it("prefers a guest display name", () => {
    expect(messageAuthorLabel({ guestName: "Alex", profileName: "Jordan" })).toBe("Alex");
    expect(messageAuthorLabel({ guestName: "  ", profileName: "Jordan" })).toBe("Jordan");
    expect(messageAuthorLabel({})).toBe("Someone");
  });
});
