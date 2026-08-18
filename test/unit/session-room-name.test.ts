import { describe, expect, it } from "vitest";
import {
  guestIdentity,
  memberIdentity,
  parseParticipantIdentity,
  sessionRoomName,
} from "@/lib/sessions/room-name";

describe("Session LiveKit room names", () => {
  it("keeps a stable room name across instances", () => {
    expect(sessionRoomName("abc")).toBe("tempo-session-abc");
  });

  it("never parses a guest identity as a member", () => {
    expect(memberIdentity("user-1")).toBe("u:user-1");
    expect(guestIdentity("guest-1")).toBe("g:guest-1");
    expect(parseParticipantIdentity("u:user-1")).toEqual({ kind: "member", id: "user-1" });
    expect(parseParticipantIdentity("g:guest-1")).toEqual({ kind: "guest", id: "guest-1" });
    expect(parseParticipantIdentity("user-1")).toBeNull();
    expect(parseParticipantIdentity("g:")).toBeNull();
    expect(parseParticipantIdentity(null)).toBeNull();
  });
});
