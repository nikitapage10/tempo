import { describe, expect, it } from "vitest";
import { assignTracksToGroupOrder } from "@/lib/tracks/bulk-group-assign";

describe("assignTracksToGroupOrder", () => {
  const tracks = [
    { id: "a", list_group_id: null },
    { id: "b", list_group_id: "g1" },
    { id: "c", list_group_id: "g1" },
    { id: "d", list_group_id: null },
    { id: "e", list_group_id: "g2" },
  ];

  it("moves selected tracks into an existing group, preserving order", () => {
    const next = assignTracksToGroupOrder({
      orderedTracks: tracks,
      groupIds: ["g1", "g2"],
      selectedIds: ["a", "d"],
      targetGroupId: "g1",
    });
    expect(next.map((r) => [r.id, r.list_group_id])).toEqual([
      ["b", "g1"],
      ["c", "g1"],
      ["a", "g1"],
      ["d", "g1"],
      ["e", "g2"],
    ]);
  });

  it("ungroups selected tracks", () => {
    const next = assignTracksToGroupOrder({
      orderedTracks: tracks,
      groupIds: ["g1", "g2"],
      selectedIds: ["b", "e"],
      targetGroupId: null,
    });
    expect(next.map((r) => [r.id, r.list_group_id])).toEqual([
      ["c", "g1"],
      ["a", null],
      ["d", null],
      ["b", null],
      ["e", null],
    ]);
  });

  it("accepts a brand-new group id not yet in groupIds", () => {
    const next = assignTracksToGroupOrder({
      orderedTracks: tracks,
      groupIds: ["g1"],
      selectedIds: ["a"],
      targetGroupId: "g-new",
    });
    expect(next.find((r) => r.id === "a")).toEqual({
      id: "a",
      list_sort: expect.any(Number),
      list_group_id: "g-new",
    });
    expect(next.some((r) => r.list_group_id === "g-new")).toBe(true);
  });
});
