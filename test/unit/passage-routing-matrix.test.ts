import { describe, expect, it } from "vitest";
import { hasUnfinishedMusicArtist, shouldSendToOrigin } from "@/lib/auth/origin-gate";
import {
  isTeamMemberAccount,
  originIsForThisAccount,
  shouldSendToPassage,
} from "@/lib/auth/passage-gate";

/**
 * The whole arrival decision in one place, exactly as app/(app)/layout.tsx
 * composes it. This is the matrix that regressed: a Pro whose workspace rows
 * did not exist yet looked identical to a brand new artist.
 */
function route(input: {
  owned: Parameters<typeof shouldSendToOrigin>[0]["owned"];
  hasMembership: boolean;
  platformRole: string | null;
  passageStatus: string | null;
}): "/origin" | "/passage" | "app" {
  const isPro = isTeamMemberAccount({
    platformRole: input.platformRole,
    hasTeamMembership: input.hasMembership,
  });
  const sendingToOrigin =
    originIsForThisAccount({
      isTeamMember: isPro,
      hasUnfinishedMusicArtist: hasUnfinishedMusicArtist(input.owned),
    }) && shouldSendToOrigin({ owned: input.owned, hasMembership: input.hasMembership });
  if (sendingToOrigin) return "/origin";
  if (
    shouldSendToPassage({
      platformRole: input.platformRole,
      hasTeamMembership: input.hasMembership,
      passageStatus: input.passageStatus,
      sendingToOrigin,
    })
  ) {
    return "/passage";
  }
  return "app";
}

const personal = {
  id: "home",
  user_id: "u",
  workspace_kind: "personal",
  origin_status: "legacy_complete",
};
const freshMusic = {
  id: "m",
  user_id: "u",
  workspace_kind: "artist",
  origin_status: "not_started",
};
const doneMusic = {
  id: "m",
  user_id: "u",
  workspace_kind: "artist",
  origin_status: "complete",
};

describe("arrival routing matrix", () => {
  it("admin-invited Pro on first load, before any workspace row exists", () => {
    expect(
      route({ owned: [], hasMembership: false, platformRole: "team_member", passageStatus: null })
    ).toBe("/passage");
  });

  it("Pro once their personal home exists", () => {
    expect(
      route({
        owned: [personal],
        hasMembership: false,
        platformRole: "team_member",
        passageStatus: null,
      })
    ).toBe("/passage");
  });

  it("artist-invited Pro, membership only, no rows yet", () => {
    expect(
      route({ owned: [], hasMembership: true, platformRole: "artist", passageStatus: null })
    ).toBe("/passage");
  });

  it("Pro who finished Passage goes to the app", () => {
    expect(
      route({
        owned: [personal],
        hasMembership: false,
        platformRole: "team_member",
        passageStatus: "complete",
      })
    ).toBe("app");
  });

  it("Pro who later accepts an artist invite still gets Origin", () => {
    expect(
      route({
        owned: [personal, freshMusic],
        hasMembership: false,
        platformRole: "team_member",
        passageStatus: "complete",
      })
    ).toBe("/origin");
  });

  it("brand new solo artist signup is untouched", () => {
    expect(
      route({ owned: [], hasMembership: false, platformRole: "artist", passageStatus: null })
    ).toBe("/origin");
  });

  it("established artist goes straight to the app", () => {
    expect(
      route({ owned: [doneMusic], hasMembership: false, platformRole: "artist", passageStatus: null })
    ).toBe("app");
  });

  it("track collaborator is never put through Passage", () => {
    expect(
      route({ owned: [personal], hasMembership: false, platformRole: null, passageStatus: null })
    ).toBe("app");
  });
});
