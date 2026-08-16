import { describe, expect, it } from "vitest";
import type { Artist } from "@/lib/types";
import {
  homePathForMode,
  isPathAllowedForMode,
  ownedMusicArtists,
  pickDefaultArtistId,
  pickResumeArtistId,
  resolveWorkspaceMode,
  socialAuthorArtistId,
} from "@/lib/workspace-mode";

function artist(partial: Partial<Artist> & Pick<Artist, "id" | "user_id" | "name">): Artist {
  return {
    logo_url: null,
    emblem_url: null,
    banner_url: null,
    banner_color: null,
    banner_color_end: null,
    palette_id: "spectra",
    ice_color: null,
    amber_color: null,
    sort: 0,
    spotify_artist_id: null,
    soundcloud_user_id: null,
    apple_artist_id: null,
    origin_status: "legacy_complete",
    origin_completed_at: null,
    origin_skipped_at: null,
    demo_kind: null,
    workspace_kind: "artist",
    created_at: new Date(0).toISOString(),
    ...partial,
  };
}

describe("workspace mode", () => {
  const me = "user-1";
  const music = artist({
    id: "a-music",
    user_id: me,
    name: "Jane",
    workspace_kind: "artist",
    origin_status: "complete",
  });
  const personal = artist({
    id: "a-work",
    user_id: me,
    name: "Jane",
    workspace_kind: "personal",
  });
  const managed = artist({ id: "a-other", user_id: "owner-2", name: "Nikita" });

  it("treats an owned music artist as My artist", () => {
    expect(resolveWorkspaceMode(music, me)).toBe("artist");
  });

  it("treats a personal workspace as My work", () => {
    expect(resolveWorkspaceMode(personal, me)).toBe("work");
  });

  it("treats a membership-visible artist as an entered workspace", () => {
    expect(resolveWorkspaceMode(managed, me)).toBe("entered");
  });

  it("defaults team members onto their personal home", () => {
    expect(pickDefaultArtistId([managed, personal, music], me)).toBe("a-work");
    expect(pickDefaultArtistId([managed], me)).toBe("a-other");
    expect(pickDefaultArtistId([music], me)).toBe("a-music");
  });

  it("never resumes demo data over a Pro's personal home", () => {
    const demo = artist({
      id: "a-demo",
      user_id: me,
      name: "PRESIDENT",
      demo_kind: "president-v5",
      origin_status: "complete",
    });
    expect(pickResumeArtistId([managed, personal, demo], me, "a-demo")).toBe(
      "a-work"
    );
    expect(pickResumeArtistId([managed, personal, demo], me, null)).toBe(
      "a-work"
    );
    expect(pickResumeArtistId([managed, personal, music], me, null)).toBe(
      "a-work"
    );
    expect(pickResumeArtistId([demo], me, "a-demo")).toBe("a-demo");
  });

  it("does not treat a teammate's leftover email-named artist as My artist", () => {
    const leftover = artist({
      id: "a-music-glitch",
      user_id: me,
      name: "music",
      workspace_kind: "artist",
      origin_status: "not_started",
    });
    expect(resolveWorkspaceMode(leftover, me, [leftover, managed])).toBe("work");
    expect(pickDefaultArtistId([leftover, managed], me)).toBe("a-music-glitch");
    expect(ownedMusicArtists([leftover, leftover, managed], me)).toEqual([]);
  });

  it("still treats a dual user's finished music artist as My artist", () => {
    const finished = artist({
      id: "a-real",
      user_id: me,
      name: "music",
      workspace_kind: "artist",
      origin_status: "complete",
    });
    expect(resolveWorkspaceMode(finished, me, [finished, managed, personal])).toBe(
      "artist"
    );
    expect(ownedMusicArtists([finished, managed, personal], me).map((a) => a.id)).toEqual([
      "a-real",
    ]);
  });

  it("preserves a pre-Origin legacy artist after they join a team", () => {
    const legacy = artist({
      id: "a-legacy",
      user_id: me,
      name: "Existing Artist",
      workspace_kind: "artist",
      origin_status: "legacy_complete",
    });
    expect(resolveWorkspaceMode(legacy, me, [legacy, managed])).toBe("artist");
    expect(ownedMusicArtists([legacy, managed], me).map((a) => a.id)).toEqual([
      "a-legacy",
    ]);
    expect(pickDefaultArtistId([managed, personal, legacy], me)).toBe("a-work");
  });

  it("posts as the personal workspace unless in My artist", () => {
    expect(socialAuthorArtistId([personal, music, managed], music, me)).toBe("a-music");
    expect(socialAuthorArtistId([personal, music, managed], personal, me)).toBe("a-work");
    expect(socialAuthorArtistId([personal, music, managed], managed, me)).toBe("a-work");
  });

  it("hides artist studio routes from My work", () => {
    expect(isPathAllowedForMode("/board", "work", {})).toBe(false);
    expect(isPathAllowedForMode("/artist", "work", {})).toBe(false);
    expect(isPathAllowedForMode("/artist/team", "work", {})).toBe(false);
    expect(isPathAllowedForMode("/artist/teammate", "work", {})).toBe(true);
    expect(isPathAllowedForMode("/profile", "work", {})).toBe(true);
    expect(isPathAllowedForMode("/team", "work", {})).toBe(true);
    expect(isPathAllowedForMode("/tasks", "work", {})).toBe(true);
  });

  it("lets My work open another artist's network profile", () => {
    expect(isPathAllowedForMode("/artist/president", "work", {})).toBe(true);
    expect(isPathAllowedForMode("/artist/someone", "work", {})).toBe(true);
  });

  it("gates entered-workspace catalog routes on grants", () => {
    expect(isPathAllowedForMode("/board", "entered", {})).toBe(false);
    expect(isPathAllowedForMode("/board", "entered", { catalog: "read" })).toBe(true);
    expect(isPathAllowedForMode("/artist", "entered", {})).toBe(true);
    expect(homePathForMode("entered")).toBe("/team");
    expect(homePathForMode("work")).toBe("/team");
  });
});
