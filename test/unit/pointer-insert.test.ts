import { describe, expect, it } from "vitest";
import {
  insertBeforeIdFromPointer,
  refineTrackInsertSlot,
} from "@/lib/dnd/pointer-insert";

describe("insertBeforeIdFromPointer", () => {
  const items = [
    { id: "a", top: 0, height: 40 },
    { id: "b", top: 50, height: 40 },
    { id: "c", top: 100, height: 40 },
  ];

  it("uses the top half of a card as insert-before", () => {
    expect(insertBeforeIdFromPointer(items, 55)).toBe("b");
  });

  it("uses the bottom half of a card as insert-after (before the next card)", () => {
    expect(insertBeforeIdFromPointer(items, 75)).toBe("c");
  });

  it("appends after the last card's bottom half", () => {
    expect(insertBeforeIdFromPointer(items, 125)).toBe(null);
  });

  it("inserts at the start above the first card", () => {
    expect(insertBeforeIdFromPointer(items, -10)).toBe("a");
  });

  it("ignores the card being dragged", () => {
    expect(insertBeforeIdFromPointer(items, 75, "b")).toBe("c");
  });
});

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
