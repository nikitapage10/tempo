import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  filterTop8Candidates,
  partitionTop8,
  type Top8Candidate,
} from "@/lib/social/top8";

function person(over: Partial<Top8Candidate> & Pick<Top8Candidate, "id" | "name">): Top8Candidate {
  return {
    handle: null,
    emblemUrl: null,
    paletteId: null,
    iceColor: null,
    amberColor: null,
    ...over,
  };
}

const pool: Top8Candidate[] = [
  person({ id: "1", name: "Niko", handle: "niko" }),
  person({ id: "2", name: "Aria Vale", handle: "aria" }),
  person({ id: "3", name: "Sleep Token", handle: "sleep-token" }),
];

describe("filterTop8Candidates", () => {
  it("returns everyone when the query is empty", () => {
    expect(filterTop8Candidates(pool, "")).toEqual(pool);
    expect(filterTop8Candidates(pool, "   ")).toEqual(pool);
  });

  it("matches display name or handle, with or without @", () => {
    expect(filterTop8Candidates(pool, "aria").map((c) => c.id)).toEqual(["2"]);
    expect(filterTop8Candidates(pool, "Sleep").map((c) => c.id)).toEqual(["3"]);
    expect(filterTop8Candidates(pool, "@niko").map((c) => c.id)).toEqual(["1"]);
    expect(filterTop8Candidates(pool, "TOKEN").map((c) => c.id)).toEqual(["3"]);
  });

  it("returns nothing when nobody matches", () => {
    expect(filterTop8Candidates(pool, "illenium")).toEqual([]);
  });
});

describe("partitionTop8", () => {
  it("counts unresolved picks against the eight slots", () => {
    // Every id here belongs to a profile that was deleted, so none resolve.
    const dead = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const slots = partitionTop8(dead, pool);
    expect(slots.picked).toEqual([]);
    expect(slots.unavailable).toEqual(dead);
    // The bug: emptyCount used to be 8, offering slots that add() refused.
    expect(slots.emptyCount).toBe(0);
  });

  it("frees a slot once the dead pick is dropped", () => {
    const slots = partitionTop8(["1", "gone"], pool);
    expect(slots.picked.map((c) => c.id)).toEqual(["1"]);
    expect(slots.unavailable).toEqual(["gone"]);
    expect(slots.emptyCount).toBe(6);
    expect(partitionTop8(["1"], pool).emptyCount).toBe(7);
  });

  it("holds placeholders back until follows have loaded", () => {
    const slots = partitionTop8(["1", "gone"], [], { candidatesReady: false });
    expect(slots.picked).toEqual([]);
    expect(slots.unavailable).toEqual([]);
  });
});

describe("Top 8 picker dismiss", () => {
  it("uses an explicit backdrop instead of a document pointer listener", () => {
    const src = readFileSync(
      resolve(process.cwd(), "components/social/top8-rail.tsx"),
      "utf8"
    );
    expect(src).toContain('className="fixed inset-0 z-[99]"');
    expect(src).not.toContain('document.addEventListener("pointerdown"');
    expect(src).toContain("add(c.id)");
    expect(src).toContain("e.preventDefault()");
  });
});
