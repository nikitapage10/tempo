import { describe, expect, it } from "vitest";
import {
  isTeamMemberAccount,
  passageFinished,
  shouldSendToPassage,
} from "@/lib/auth/passage-gate";

const base = {
  platformRole: null as string | null,
  hasTeamMembership: false,
  passageStatus: null as string | null,
  sendingToOrigin: false,
};

describe("isTeamMemberAccount", () => {
  it("counts an admin-issued team_member invite", () => {
    expect(
      isTeamMemberAccount({ platformRole: "team_member", hasTeamMembership: false })
    ).toBe(true);
  });

  it("counts an artist putting somebody on their team", () => {
    expect(
      isTeamMemberAccount({ platformRole: "artist", hasTeamMembership: true })
    ).toBe(true);
  });

  it("does not count a plain artist account", () => {
    expect(
      isTeamMemberAccount({ platformRole: "artist", hasTeamMembership: false })
    ).toBe(false);
  });

  it("does not count an administrator with no team", () => {
    expect(
      isTeamMemberAccount({ platformRole: "administrator", hasTeamMembership: false })
    ).toBe(false);
  });
});

describe("shouldSendToPassage", () => {
  it("sends an admin-invited team member", () => {
    expect(
      shouldSendToPassage({ ...base, platformRole: "team_member" })
    ).toBe(true);
  });

  it("sends an artist-invited team member — both routes are equal", () => {
    expect(shouldSendToPassage({ ...base, hasTeamMembership: true })).toBe(true);
  });

  it("leaves a track collaborator alone", () => {
    // No platform role and no artist_members row: someone added to comment on
    // one song is not joining a team.
    expect(shouldSendToPassage(base)).toBe(false);
  });

  it("never interrupts Origin", () => {
    expect(
      shouldSendToPassage({
        ...base,
        platformRole: "team_member",
        sendingToOrigin: true,
      })
    ).toBe(false);
  });

  it("does not repeat once completed", () => {
    expect(
      shouldSendToPassage({
        ...base,
        platformRole: "team_member",
        passageStatus: "complete",
      })
    ).toBe(false);
  });

  it("respects a deliberate skip", () => {
    expect(
      shouldSendToPassage({
        ...base,
        hasTeamMembership: true,
        passageStatus: "skipped",
      })
    ).toBe(false);
  });

  it("resumes an unfinished draft", () => {
    expect(
      shouldSendToPassage({
        ...base,
        hasTeamMembership: true,
        passageStatus: "in_progress",
      })
    ).toBe(true);
  });
});

describe("passageFinished", () => {
  it("treats complete and skipped as done, nothing else", () => {
    expect(passageFinished("complete")).toBe(true);
    expect(passageFinished("skipped")).toBe(true);
    expect(passageFinished("in_progress")).toBe(false);
    expect(passageFinished(null)).toBe(false);
  });
});
