import { describe, expect, it } from "vitest";
import { dropSlotId, parseDropSlotId, sameDropSlot } from "@/lib/dnd/drop-slot";
import { insertIdBefore, isNoOpInsert, ranksForIds } from "@/lib/dnd/insert";

describe("insertIdBefore", () => {
  it("inserts before a target id", () => {
    expect(insertIdBefore(["a", "b", "c"], "x", "b")).toEqual(["a", "x", "b", "c"]);
  });

  it("appends when beforeId is null", () => {
    expect(insertIdBefore(["a", "b"], "c", null)).toEqual(["a", "b", "c"]);
  });

  it("moves an existing id without duplicating", () => {
    expect(insertIdBefore(["a", "b", "c"], "a", "c")).toEqual(["b", "a", "c"]);
  });
});

describe("isNoOpInsert", () => {
  it("detects unchanged position", () => {
    expect(isNoOpInsert(["a", "b", "c"], "b", "c")).toBe(true);
    expect(isNoOpInsert(["a", "b", "c"], "b", "a")).toBe(false);
  });
});

describe("ranksForIds", () => {
  it("assigns spaced sort values", () => {
    expect(ranksForIds(["a", "b"])).toEqual([
      { id: "a", sort: 100 },
      { id: "b", sort: 200 },
    ]);
  });
});

describe("drop slots", () => {
  it("round-trips slot ids", () => {
    const slot = { kind: "track" as const, containerId: "stage-1", beforeId: "track-2" };
    expect(parseDropSlotId(dropSlotId(slot))).toEqual(slot);
    expect(parseDropSlotId(dropSlotId({ ...slot, beforeId: null }))).toEqual({
      ...slot,
      beforeId: null,
    });
  });

  it("compares slots", () => {
    const a = { kind: "task" as const, containerId: "today", beforeId: "t1" };
    const b = { kind: "task" as const, containerId: "today", beforeId: "t1" };
    expect(sameDropSlot(a, b)).toBe(true);
    expect(sameDropSlot(a, { ...b, beforeId: "t2" })).toBe(false);
  });
});
