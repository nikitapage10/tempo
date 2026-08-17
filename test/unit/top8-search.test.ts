import { describe, expect, it } from "vitest";
import { filterTop8Candidates, type Top8Candidate } from "@/lib/social/top8";

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
