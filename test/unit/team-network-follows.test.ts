import { describe, expect, it } from "vitest";
import { teamFollowEdges } from "@/lib/social/connect-team-follows";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("team network follows", () => {
  it("makes a team member and their artist follow each other", () => {
    const edges = teamFollowEdges({
      links: [{ artistId: "artist-1", memberUserId: "user-member" }],
      profiles: [
        { id: "prof-artist", artistId: "artist-1", ownerUserId: "user-artist" },
        { id: "prof-home", artistId: "home-1", ownerUserId: "user-member" },
      ],
      personalArtistIds: new Set(["home-1"]),
    });
    expect(edges).toEqual([
      { follower_profile_id: "prof-home", followee_profile_id: "prof-artist" },
      { follower_profile_id: "prof-artist", followee_profile_id: "prof-home" },
    ]);
  });

  it("skips the pair until both sides are on the network", () => {
    expect(
      teamFollowEdges({
        links: [{ artistId: "artist-1", memberUserId: "user-member" }],
        profiles: [
          { id: "prof-home", artistId: "home-1", ownerUserId: "user-member" },
        ],
        personalArtistIds: new Set(["home-1"]),
      })
    ).toEqual([]);
  });

  it("does not follow yourself if you own both sides", () => {
    expect(
      teamFollowEdges({
        links: [{ artistId: "artist-1", memberUserId: "user-artist" }],
        profiles: [
          { id: "prof-artist", artistId: "artist-1", ownerUserId: "user-artist" },
          { id: "prof-home", artistId: "home-1", ownerUserId: "user-artist" },
        ],
        personalArtistIds: new Set(["home-1"]),
      })
    ).toEqual([]);
  });

  it("wires join, invite accept, and Social backfill", () => {
    expect(read("app/api/network/join/route.ts")).toContain("connectTeamNetworkFollows");
    expect(read("app/api/team-invite/[token]/route.ts")).toContain(
      "connectTeamNetworkFollows"
    );
    expect(read("app/(app)/social/social-view.tsx")).toContain(
      "/api/network/team-follows"
    );
  });
});
