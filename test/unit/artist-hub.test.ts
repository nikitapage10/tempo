import { describe, expect, it } from "vitest";
import {
  compactCount,
  countDueThisWeek,
  countOverdueFromCatalog,
  emptyHubSnapshot,
  pickFollowerTrend,
  signedDelta,
  summarizeRoster,
} from "@/lib/api/artist-hub";

describe("artist hub snapshot helpers", () => {
  it("counts overdue tasks, track targets, and open project deadlines", () => {
    expect(
      countOverdueFromCatalog({
        today: "2026-08-13",
        tasks: [
          { status: "todo", due_date: "2026-08-12" },
          { status: "done", due_date: "2026-08-01" },
          { status: "todo", due_date: "2026-08-13" },
          { status: "todo", due_date: null },
        ],
        tracks: [{ deadline: "2026-08-10" }, { deadline: "2026-08-20" }, { deadline: null }],
        projects: [
          { status: "active", deadline: "2026-08-01" },
          { status: "done", deadline: "2026-08-01" },
          { status: "parked", deadline: "2026-08-12" },
        ],
      })
    ).toBe(4);
  });

  it("counts open tasks due this week, exclusive of the far edge", () => {
    expect(
      countDueThisWeek({
        today: "2026-08-13",
        weekEnd: "2026-08-20",
        tasks: [
          { status: "todo", due_date: "2026-08-13" },
          { status: "todo", due_date: "2026-08-19" },
          { status: "todo", due_date: "2026-08-20" },
          { status: "done", due_date: "2026-08-14" },
        ],
      })
    ).toBe(2);
  });

  it("picks the platform with the most followers and a delta from the prior snapshot", () => {
    expect(
      pickFollowerTrend([
        { platform: "spotify", followers: 100, captured_on: "2026-07-01" },
        { platform: "spotify", followers: 120, captured_on: "2026-08-01" },
        { platform: "soundcloud", followers: 800, captured_on: "2026-07-01" },
        { platform: "soundcloud", followers: 940, captured_on: "2026-08-01" },
      ])
    ).toEqual({ platform: "soundcloud", followers: 940, delta: 140 });
  });

  it("summarizes only the figures that actually exist", () => {
    const a = {
      ...emptyHubSnapshot(),
      overdue: 2,
      weekCount: 1,
      trackCount: 10,
      followers: 940,
      followerDelta: 140,
    };
    const b = { ...emptyHubSnapshot(), overdue: 0, networkFollowers: 12 };
    expect(summarizeRoster([a, b])).toEqual({
      overdue: 2,
      week: 1,
      tracks: 10,
      followers: 940,
      followerDelta: 140,
      networkFollowers: 12,
    });
  });

  it("formats compact counts and signed deltas", () => {
    expect(compactCount(null)).toBe("—");
    expect(compactCount(940)).toBe("940");
    expect(compactCount(9400)).toBe("9.4K");
    expect(signedDelta(140)).toBe("+140");
    expect(signedDelta(-20)).toBe("-20");
  });
});
