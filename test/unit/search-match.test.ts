import { describe, expect, it } from "vitest";
import { matchSearchCatalog } from "@/lib/search/match";
import { parseSearchQuery } from "@/lib/search/parse-query";
import type { SearchCatalog } from "@/lib/api/search-catalog";

function emptyCatalog(over: Partial<SearchCatalog> = {}): SearchCatalog {
  return {
    tracks: [],
    projects: [],
    tasks: [],
    people: [],
    messages: [],
    notes: [],
    stages: [],
    spaces: [],
    posts: [],
    scenes: [],
    ...over,
  };
}

const tracks: SearchCatalog["tracks"] = [
  {
    id: "a",
    space_id: "s1",
    title: "Battle Wounds",
    artist_alias: null,
    type: "original",
    bpm: 140,
    musical_key: "Am",
    genre: null,
    destination: null,
    momentum: "active",
    tags: [],
    notes: "needs a BPM pass",
    next_action: null,
    waiting_on: null,
    blocked_reason: null,
    artwork_url: null,
    space_name: "Originals",
  },
  {
    id: "b",
    space_id: "s1",
    title: "Night Drive",
    artist_alias: null,
    type: "original",
    bpm: 148,
    musical_key: "Dm",
    genre: null,
    destination: null,
    momentum: "active",
    tags: [],
    notes: null,
    next_action: null,
    waiting_on: null,
    blocked_reason: null,
    artwork_url: null,
    space_name: "Originals",
  },
  {
    id: "c",
    space_id: "s1",
    title: "BPM Study",
    artist_alias: null,
    type: "original",
    bpm: 90,
    musical_key: null,
    genre: null,
    destination: null,
    momentum: "stalled",
    tags: [],
    notes: null,
    next_action: null,
    waiting_on: null,
    blocked_reason: null,
    artwork_url: null,
    space_name: "Originals",
  },
  {
    id: "d",
    space_id: "s1",
    title: "Club 140",
    artist_alias: null,
    type: "remix",
    bpm: null,
    musical_key: null,
    genre: null,
    destination: null,
    momentum: "active",
    tags: [],
    notes: null,
    next_action: null,
    waiting_on: null,
    blocked_reason: null,
    artwork_url: null,
    space_name: "Originals",
  },
];

describe("parseSearchQuery BPM", () => {
  it("understands exact bpm phrasing in either order", () => {
    expect(parseSearchQuery("bpm 140").bpm).toEqual({
      kind: "exact",
      bpm: 140,
    });
    expect(parseSearchQuery("140 bpm").bpm).toEqual({
      kind: "exact",
      bpm: 140,
    });
    expect(parseSearchQuery("140").bpm).toEqual({ kind: "exact", bpm: 140 });
    expect(parseSearchQuery("BPM 140").textTokens).toEqual([]);
  });

  it("understands ranges with hyphen, to, and through", () => {
    expect(parseSearchQuery("140-150").bpm).toEqual({
      kind: "range",
      min: 140,
      max: 150,
    });
    expect(parseSearchQuery("bpm 140 through 150").bpm).toEqual({
      kind: "range",
      min: 140,
      max: 150,
    });
    expect(parseSearchQuery("140 to 150").bpm).toEqual({
      kind: "range",
      min: 140,
      max: 150,
    });
  });

  it("does not treat lone bpm as a text token that should match everything", () => {
    expect(parseSearchQuery("bpm")).toEqual({
      normalized: "bpm",
      textTokens: [],
      bpm: null,
    });
  });
});

describe("matchSearchCatalog BPM intelligence", () => {
  const catalog = emptyCatalog({ tracks: [...tracks] });

  it("ranks bpm 140 and 140 bpm the same and prefers the real tempo", () => {
    const a = matchSearchCatalog(catalog, "bpm 140");
    const b = matchSearchCatalog(catalog, "140 bpm");
    expect(a.map((h) => h.id)).toEqual(["track:a"]);
    expect(b.map((h) => h.id)).toEqual(["track:a"]);
    expect(a[0]!.score).toBe(b[0]!.score);
  });

  it("returns tracks in a bpm range", () => {
    const hits = matchSearchCatalog(catalog, "bpm 140 through 150");
    expect(hits.map((h) => h.id).sort()).toEqual(["track:a", "track:b"]);
  });

  it("does not return every timed track for the word bpm alone", () => {
    expect(matchSearchCatalog(catalog, "bpm")).toEqual([]);
  });

  it("still finds a title that contains BPM when searching that title", () => {
    const hits = matchSearchCatalog(catalog, "BPM Study");
    expect(hits.some((h) => h.id === "track:c")).toBe(true);
  });

  it("does not treat Club 140 as a 140 BPM track on a bpm query", () => {
    const hits = matchSearchCatalog(catalog, "bpm 140");
    expect(hits.map((h) => h.id)).not.toContain("track:d");
  });
});
