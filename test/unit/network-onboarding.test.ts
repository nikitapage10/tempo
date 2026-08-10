import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("network onboarding boundaries", () => {
  it("does not provision Social or Scenes before the real artist joins", () => {
    const route = read("app/api/onboarding/route.ts");
    expect(route).toContain("isRealArtistOnNetwork(service, userId)");

    const social = read("app/(app)/social/social-view.tsx");
    expect(social).toContain("const socialDataProfileId = onNetwork ? myProfileId : null");
    expect(social).not.toContain("starterPreview");
  });

  it("keeps network membership active while Green Room reconciliation retries", () => {
    const route = read("app/api/network/join/route.ts");
    expect(route).toContain("Green Room reconciliation pending");
    expect(route).not.toContain("visibility: existing.visibility");
  });

  it("does not create synthetic starter-feed follows", () => {
    const provisioning = read("lib/onboarding-starter-community.ts");
    expect(provisioning).not.toContain("async function seedSocial");
    expect(provisioning).not.toContain('from("profile_follows").upsert');
    expect(provisioning).toContain("removeLegacyStarterFollows");
    expect(provisioning).toContain('.is("demo_kind", null)');
  });

  it("removes the retired synthetic posts and their automatic follow edges", () => {
    const migration = read("migrations/077_remove_synthetic_starter_feed.sql");
    expect(migration).toContain("delete from profile_follows");
    expect(migration).toContain("delete from posts");
    expect(migration).toContain("delete from scene_personas");
    expect(migration).toContain("starter_community_provisioned_at is not null");
    expect(migration).toContain("set visibility = 'private', published_at = null");
    expect(migration).toContain("artist.demo_kind is not null");
    expect(migration).toContain("'autotuneauntie'");
    expect(migration).toContain("'velvetstatic'");
  });
});
