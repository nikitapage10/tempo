import { describe, expect, it } from "vitest";
import { teamFanPose, teamFanStageMinHeight } from "@/components/team/team-constellation";

describe("team fan layout", () => {
  it("puts the artist at the center in front", () => {
    const artist = teamFanPose(true, 0);
    expect(artist.x).toBe(0);
    expect(artist.y).toBe(6);
    expect(artist.rotate).toBe(0);
    expect(artist.zIndex).toBeGreaterThan(20);
  });

  it("fans the first member to the side behind the artist", () => {
    const member = teamFanPose(false, 0);
    expect(member.x).toBeLessThan(0);
    expect(member.zIndex).toBeLessThan(teamFanPose(true, 0).zIndex);
  });

  it("keeps a full team inside a laptop screen", () => {
    // Six people fan three ranks out on each side. At the original step the
    // outer pair sat past the edge of the panel and got clipped.
    const outer = teamFanPose(false, 5, 6);
    expect(Math.abs(outer.x) + 128).toBeLessThan(640);
    expect(Math.abs(outer.rotate)).toBeLessThanOrEqual(18);
    // A small roster is untouched.
    expect(teamFanPose(false, 1, 2).x).toBe(220);
  });

  it("keeps the photo stage short when the roster is small", () => {
    expect(teamFanStageMinHeight(1)).toBeLessThan(480);
    expect(teamFanStageMinHeight(1)).toBeGreaterThan(teamFanStageMinHeight(0));
    expect(teamFanStageMinHeight(5)).toBeGreaterThan(teamFanStageMinHeight(1));
  });
});
