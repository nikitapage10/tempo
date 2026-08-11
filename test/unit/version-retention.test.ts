import { describe, expect, it } from "vitest";
import { selectVersionsToEvict, type VersionForRetention } from "@/lib/version-prune";

function v(
  overrides: Partial<VersionForRetention> & { id: string; version_no: number }
): VersionForRetention {
  return { is_current: false, cloud_state: "in_cloud", ...overrides };
}

describe("selectVersionsToEvict", () => {
  it("keeps the current version and the one before it; evicts nothing else when nobody has a local copy", () => {
    const versions = [
      v({ id: "v3", version_no: 3, is_current: true }),
      v({ id: "v2", version_no: 2 }),
      v({ id: "v1", version_no: 1 }),
    ];
    const evicted = selectVersionsToEvict(versions, () => false);
    // v1 is outside the cap but has no confirmed local copy anywhere, so it
    // must NOT be evicted — this is the core safety guarantee.
    expect(evicted).toEqual([]);
  });

  it("evicts versions outside the cap once a confirmed local copy exists", () => {
    const versions = [
      v({ id: "v3", version_no: 3, is_current: true }),
      v({ id: "v2", version_no: 2 }),
      v({ id: "v1", version_no: 1 }),
    ];
    const evicted = selectVersionsToEvict(versions, (id) => id === "v1");
    expect(evicted).toEqual(["v1"]);
  });

  it("never evicts the current version, even if it has a local copy and is somehow not newest", () => {
    const versions = [
      v({ id: "v1", version_no: 1, is_current: true }),
      v({ id: "v3", version_no: 3 }),
      v({ id: "v2", version_no: 2 }),
    ];
    const evicted = selectVersionsToEvict(versions, () => true);
    expect(evicted).not.toContain("v1");
    // v2 is the "one before" the kept set by cap position (current + 1 newest
    // by version_no among the rest) — only the remaining excess evicts.
    expect(evicted).toEqual(["v2"]);
  });

  it("ignores already-evicted (local_only) versions — nothing to evict twice", () => {
    const versions = [
      v({ id: "v3", version_no: 3, is_current: true }),
      v({ id: "v2", version_no: 2 }),
      v({ id: "v1", version_no: 1, cloud_state: "local_only" }),
    ];
    const evicted = selectVersionsToEvict(versions, () => true);
    expect(evicted).toEqual([]);
  });

  it("pin state has no bearing on eviction — only cap position and local-copy confirmation matter", () => {
    // is_pinned isn't part of VersionForRetention at all anymore; this test
    // documents that omission is deliberate, not an oversight.
    const versions = [
      v({ id: "v3", version_no: 3, is_current: true }),
      v({ id: "v2", version_no: 2 }),
      v({ id: "v1", version_no: 1 }),
    ];
    const evicted = selectVersionsToEvict(versions, () => true, 2);
    expect(evicted).toEqual(["v1"]);
  });

  it("respects a custom cap", () => {
    const versions = [
      v({ id: "v4", version_no: 4, is_current: true }),
      v({ id: "v3", version_no: 3 }),
      v({ id: "v2", version_no: 2 }),
      v({ id: "v1", version_no: 1 }),
    ];
    const evicted = selectVersionsToEvict(versions, () => true, 3);
    expect(evicted).toEqual(["v1"]);
  });
});
