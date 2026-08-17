import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  needsPassageProfileRepair,
  passageProfilePatch,
} from "@/lib/passage/profile-mapping";
import type { ArtistProfile } from "@/lib/types";
import type { MemberPassage } from "@/lib/passage/types";

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
    expect(editor).toContain("applyPassageToProfile");
    expect(editor).toContain("passageProfilePatch");
    expect(read("hooks/use-passage-state.ts")).toContain("applyPassageToProfile");
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

    const memberCard = read("components/team/my-member-profile.tsx");
    expect(memberCard).toContain('activeArtist?.workspace_kind === "personal"');
    expect(memberCard).toContain("memberAvatarUrl || workspaceAvatarUrl");
    expect(memberCard).toContain("syncMyMemberAvatarPath(workspaceAvatarUrl)");

    const artists = read("lib/api/artists.ts");
    expect(artists).toContain("syncMyMemberAvatarPath(path)");
    expect(artists).toContain("syncMyMemberAvatarPath(null)");
    expect(artists).toContain('updated.workspace_kind === "personal"');
  });
});

describe("Passage profile handoff", () => {
  const source = {
    displayName: "Nick Miller",
    roleTitles: ["Manager", "Creative director"],
    roleTitleOther: "Touring",
    entryText: "A local show pulled me in.",
    supportsText: "Independent artists.",
    functionText: "I keep releases and live plans moving.",
    interpretation: {
      headline: "Building the structure around ambitious records",
      intro: "Nick connects creative direction with the work that gets music into the world.",
      storySections: [
        { title: "The first room", body: "It started at a local show." },
      ],
    },
  };

  it("fills professional fields from confirmed Passage answers", () => {
    expect(passageProfilePatch(null, source)).toMatchObject({
      profile_kind: "pro",
      tagline: source.interpretation.headline,
      bio: source.interpretation.intro,
      roles: ["Manager", "Creative director", "Touring"],
      current_focus_body: source.functionText,
      story_sections: source.interpretation.storySections,
    });
  });

  it("never overwrites fields the Pro already edited", () => {
    const existing = {
      profile_kind: "pro",
      tagline: "My headline",
      bio: "My introduction",
      roles: ["Publicist"],
      current_focus_body: "My focus",
      story_sections: [{ title: "My chapter", body: "My words" }],
    } as ArtistProfile;
    const patch = passageProfilePatch(existing, source);
    expect(patch).not.toHaveProperty("tagline");
    expect(patch).not.toHaveProperty("bio");
    expect(patch).not.toHaveProperty("roles");
    expect(patch).not.toHaveProperty("current_focus_body");
    expect(patch).not.toHaveProperty("story_sections");
  });

  it("uses the person's own answers when the closing writer returned nothing", () => {
    const patch = passageProfilePatch(null, { ...source, interpretation: null });
    expect(patch.story_sections).toEqual([
      { title: "Where it started", body: source.entryText },
      { title: "Who I support", body: source.supportsText },
      { title: "What I do", body: source.functionText },
    ]);
  });

  it("repairs only profiles that predate Passage completion", () => {
    const passage = {
      ...source,
      status: "complete",
      currentStep: "complete",
      completedAt: "2026-08-16T18:00:00.000Z",
      updatedAt: "2026-08-16T18:00:00.000Z",
    } as MemberPassage;
    const profile = {
      updated_at: "2026-08-16T17:59:00.000Z",
    } as ArtistProfile;
    expect(needsPassageProfileRepair(profile, passage)).toBe(true);
    expect(
      needsPassageProfileRepair(
        { ...profile, updated_at: "2026-08-16T18:01:00.000Z" },
        passage
      )
    ).toBe(false);
  });
});
