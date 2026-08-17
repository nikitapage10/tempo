import { describe, expect, it } from "vitest";
import { refineTrackInsertSlot } from "@/lib/dnd/pointer-insert";

describe("refineTrackInsertSlot", () => {
  const ordered = ["a", "b", "c"];

  it("inserts before the hovered track in the top half", () => {
    expect(
      refineTrackInsertSlot(
        { kind: "track", containerId: "stage", beforeId: "b" },
        ordered,
        { y: 105 },
        { top: 100, height: 20 },
        "b"
      )
    ).toEqual({ kind: "track", containerId: "stage", beforeId: "b" });
  });

  it("inserts after the hovered track in the bottom half", () => {
    expect(
      refineTrackInsertSlot(
        { kind: "track", containerId: "stage", beforeId: "b" },
        ordered,
        { y: 115 },
        { top: 100, height: 20 },
        "b"
      )
    ).toEqual({ kind: "track", containerId: "stage", beforeId: "c" });
  });

  it("appends after the last track from the bottom half", () => {
    expect(
      refineTrackInsertSlot(
        { kind: "track", containerId: "stage", beforeId: "c" },
        ordered,
        { y: 215 },
        { top: 200, height: 20 },
        "c"
      )
    ).toEqual({ kind: "track", containerId: "stage", beforeId: null });
  });
});
