import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("first-class Pro profiles", () => {
  it("ships an additive profile-kind migration and backfills personal homes", () => {
    expect(existsSync(resolve("migrations/098_professional_profiles.sql"))).toBe(true);
    const migration = read("migrations/098_professional_profiles.sql");
    expect(migration).toContain("add column if not exists profile_kind");
    expect(migration).toContain("when artist.workspace_kind = 'personal' then 'pro'");
    expect(migration).toContain("create or replace function sync_artist_profile_identity()");
  });

  it("gives the Pro Profile page handles, career fields, links, and visibility", () => {
    const page = read("app/(app)/profile/page.tsx");
    const editor = read("components/profile/pro-identity-profile.tsx");
    expect(page).toContain("<ProIdentityProfile />");
    for (const label of [
      "Handle",
      "Professional headline",
      "About",
      "Roles",
      "Current focus",
      "Career story",
      "Links",
      "Who can message you",
    ]) {
      expect(editor).toContain(`label=\"${label}\"`);
    }
    expect(editor).toContain('profile_kind: "pro"');
    expect(editor).toContain('if (mode !== "work") return null');
    expect(editor).toContain("checkHandleAvailable");
    expect(editor).toContain("JoinNetworkDialog");
    expect(editor).toContain("savedPassage?.interpretation?.storySections");
  });

  it("uses career language on member and public handle pages", () => {
    const story = read("components/artist/profile-story.tsx");
    const memberPage = read("app/(app)/artist/[handle]/page.tsx");
    const publicPage = read("app/p/[handle]/public-profile-view.tsx");
    expect(story).toContain('variant?: "artist" | "pro"');
    expect(story).toContain("Career story");
    expect(memberPage).toContain('query.data?.profile_kind === "pro"');
    expect(publicPage).toContain('profile.profile_kind === "pro"');
  });

  it("keeps handle creation in Passage and syncs the Pro name and image", () => {
    expect(read("components/passage/passage-experience.tsx")).toContain(
      "claim your TEMPO handle"
    );
    const memberProfile = read("lib/api/member-profile.ts");
    expect(memberProfile).toContain('.eq("workspace_kind", "personal")');
    expect(memberProfile).toContain("update({ emblem_url: path })");
    expect(memberProfile).toContain("update({ name: displayName })");
  });
});
