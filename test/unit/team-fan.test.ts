import { describe, expect, it } from "vitest";
import { teamFanPose } from "@/components/team/team-constellation";

describe("team fan layout", () => {
  it("puts the artist at the center in front", () => {
    const artist = teamFanPose(true, 0);
    expect(artist.x).toBe(0);
    expect(artist.y).toBe(8);
    expect(artist.rotate).toBe(0);
    expect(artist.zIndex).toBeGreaterThan(20);
  });

  it("fans the first member to the side behind the artist", () => {
    const member = teamFanPose(false, 0);
    expect(member.x).toBeLessThan(0);
    expect(member.zIndex).toBeLessThan(teamFanPose(true, 0).zIndex);
  });
});
