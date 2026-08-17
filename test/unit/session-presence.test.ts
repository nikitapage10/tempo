import { describe, expect, it } from "vitest";
import { splitRoster } from "@/lib/sessions/presence";

describe("Session presence roster", () => {
  it("treats oncall as an explicit attribute and collapses duplicate identities", () => {
    const roster = splitRoster([
      { identity: "u:1", attributes: { oncall: "1" }, isLocal: true },
      { identity: "u:1", attributes: { oncall: "1" }, isLocal: true },
      { identity: "u:2", attributes: {}, isLocal: false },
      { identity: "g:9", attributes: { oncall: "1" } },
      { identity: "", attributes: { oncall: "1" } },
    ]);
    expect(roster.inRoom.map((row) => row.identity)).toEqual(["u:1", "u:2", "g:9"]);
    expect(roster.onCall.map((row) => row.identity)).toEqual(["u:1", "g:9"]);
  });

  it("keeps muted people on the call when the attribute is set", () => {
    const roster = splitRoster([{ identity: "u:1", attributes: { oncall: "1" } }]);
    expect(roster.onCall).toHaveLength(1);
  });
});
