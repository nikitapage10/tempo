import { describe, expect, it } from "vitest";
import {
  hasUnfinishedMusicArtist,
  pickOriginArtistId,
  planOriginArtistForInvite,
  shouldSendToOrigin,
} from "@/lib/auth/origin-gate";

const me = "user-1";
const personal = {
  id: "home",
  user_id: me,
  workspace_kind: "personal" as const,
  origin_status: "legacy_complete",
};
const leftover = {
  id: "leftover",
  user_id: me,
  workspace_kind: "artist" as const,
  origin_status: "not_started",
};
const minted = {
  id: "music",
  user_id: me,
  workspace_kind: "artist" as const,
  origin_status: "not_started",
};
const managed = {
  id: "managed",
  user_id: "owner-2",
  workspace_kind: "artist" as const,
  origin_status: "complete",
};
const legacyArtist = {
  id: "legacy-artist",
  user_id: me,
  workspace_kind: "artist" as const,
  origin_status: "legacy_complete",
};

describe("artist invite Origin gate", () => {
  it("does not trap a team-only leftover in Origin", () => {
    expect(
      shouldSendToOrigin({ owned: [leftover], hasMembership: true })
    ).toBe(false);
  });

  it("sends an upgraded team member through Origin", () => {
    expect(
      shouldSendToOrigin({ owned: [personal, minted], hasMembership: true })
    ).toBe(true);
    expect(
      shouldSendToOrigin({ owned: [leftover, minted], hasMembership: true })
    ).toBe(true);
  });

  it("still sends a brand-new artist with no rows to Origin", () => {
    expect(shouldSendToOrigin({ owned: [], hasMembership: false })).toBe(true);
  });

  it("converts a leftover home instead of running Origin on it", () => {
    expect(planOriginArtistForInvite([leftover], true)).toEqual({
      reuseId: null,
      startOrigin: true,
      convertToPersonalIds: ["leftover"],
    });
  });

  it("reuses an unfinished music artist beside a personal home", () => {
    expect(planOriginArtistForInvite([personal, minted], true)).toEqual({
      reuseId: "music",
      startOrigin: true,
      convertToPersonalIds: [],
    });
  });

  it("treats an established pre-Origin artist as finished after a team invite", () => {
    expect(
      planOriginArtistForInvite([legacyArtist], true)
    ).toEqual({
      reuseId: "legacy-artist",
      startOrigin: false,
      convertToPersonalIds: [],
    });
    expect(
      shouldSendToOrigin({ owned: [legacyArtist], hasMembership: true })
    ).toBe(false);
  });

  it("picks the owned unfinished artist, not a managed one or the home", () => {
    expect(pickOriginArtistId([personal, managed, minted], me)).toBe("music");
    expect(pickOriginArtistId([personal, managed], me)).toBe(null);
  });
});

/**
 * Trying the demo is offered from inside Origin's import chapter, so the gate
 * has to stand down while a demo exists. Without this the demo was built and
 * the redirect immediately threw the member back to Origin's first chapter,
 * which is exactly what "the demo button does nothing" looked like.
 */
describe("demo workspace and the Origin gate", () => {
  const demo = {
    id: "demo",
    user_id: me,
    workspace_kind: "artist" as const,
    origin_status: "legacy_complete",
    demo_kind: "president",
  };

  it("stands down while a demo workspace exists", () => {
    expect(
      shouldSendToOrigin({ owned: [minted, demo], hasMembership: false })
    ).toBe(false);
  });

  it("hands the gate back once the demo is removed", () => {
    expect(
      shouldSendToOrigin({ owned: [minted], hasMembership: false })
    ).toBe(true);
  });

  it("never treats the demo as this account's own unfinished artist", () => {
    expect(hasUnfinishedMusicArtist([demo])).toBe(false);
    expect(pickOriginArtistId([demo, minted], me)).toBe("music");
  });
});
