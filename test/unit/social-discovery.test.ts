import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("Social discovery", () => {
  it("builds a broad recently-active pool outside the CRM and follow graph", () => {
    const peopleApi = read("lib/api/people.ts");
    expect(peopleApi).toContain("fetchRecentlyActiveProfiles");
    expect(peopleApi).toContain('.from("posts")');
    expect(peopleApi).toContain('.from("artist_profiles")');
    expect(peopleApi).toContain('.in("visibility", ["members", "public"])');
    expect(peopleApi).toContain("LEGACY_SYNTHETIC_HANDLES.has");
    expect(peopleApi).not.toContain("fetchRecentlyActiveProfiles(opts");
  });

  it("changes only Discover to the activity globe and keeps the standard globe elsewhere", () => {
    const social = read("app/(app)/social/social-view.tsx");
    expect(social).toContain(
      'tab === "discover" ? discoverGlobePeople : globePeople'
    );
    expect(social).toContain('max={tab === "discover" ? 120 : 80}');
    expect(social).toContain("Followed and new-to-you artists");
    expect(social).toContain("Recently interacted with");
  });
});
