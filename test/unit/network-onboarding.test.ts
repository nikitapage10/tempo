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
    expect(route).toContain("connectTeamNetworkFollows");
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

  it("never writes a post or a chat message as a real member", () => {
    // The Green Room used to open with two feed posts and two chat messages
    // signed by whichever real members provisioning had picked. They never
    // wrote them, and everyone else in the room read them as genuine.
    const provisioning = read("lib/onboarding-starter-community.ts");
    expect(provisioning).not.toContain('from("posts").insert');
    expect(provisioning).not.toContain('from("messages").insert');
    expect(provisioning).not.toContain("seedSceneContent");
    // The chat thread itself is still created, so the Chat tab opens empty
    // instead of failing.
    expect(provisioning).toContain('from("conversations").insert');
  });

  it("never changes someone else's privacy setting to populate the room", () => {
    const provisioning = read("lib/onboarding-starter-community.ts");
    expect(provisioning).not.toContain('visibility: "members", published_at');
    expect(provisioning).toContain('if (profile.visibility === "private") byId.delete(profileId);');
  });

  it("removes the starter posts and messages already sitting in the room", () => {
    const migration = read("migrations/119_remove_ghostwritten_scene_starters.sql");
    const provisioning = read("lib/onboarding-starter-community.ts");
    // Every retired string still named in code must be one the cleanup deletes,
    // or a sentence nobody wrote stays in the room under a real name.
    const retired = Array.from(
      provisioning.matchAll(/RETIRED_(?:SCENE|CHAT)_STARTERS = \[([\s\S]*?)\] as const;/g)
    ).flatMap((block) => Array.from(block[1].matchAll(/"([^"]+)"/g)).map((line) => line[1]));
    expect(retired).toHaveLength(4);
    for (const body of retired) {
      expect(migration, `migration 119 does not delete: ${body}`).toContain(body);
    }
    expect(migration).toContain("delete from posts");
    expect(migration).toContain("delete from messages");
    // Scoped, so an identical sentence typed in a private thread survives.
    expect(migration).toContain("conversation.scene_id is not null");
    expect(migration).not.toMatch(/drop table|truncate/i);
  });

  it("never transfers demo follows or emits notifications from demo actors", () => {
    const followIsolation = read("migrations/076_demo_social_isolation.sql");
    expect(followIsolation).not.toContain("insert into profile_follows (follower_profile_id, followee_profile_id, created_at)");
    expect(followIsolation).toContain("Never transfer a demo's graph");

    const notificationIsolation = read("migrations/078_demo_notification_isolation.sql");
    expect(notificationIsolation).toContain("trg_reject_demo_actor_notification");
    expect(notificationIsolation).toContain("artist.demo_kind is not null");
    expect(notificationIsolation).toContain("notification.title = 'PRESIDENT followed you'");
    expect(notificationIsolation).toContain("not exists (");
  });

  it("lets an account follow its own demo without opening demos to strangers", () => {
    const migration = read("migrations/120_owner_demo_follows.sql");
    expect(migration).toContain("reject_demo_profile_follow");
    expect(migration).toContain("v_follower_owner is distinct from v_followee_owner");
    expect(migration).toContain("insert into profile_follows (follower_profile_id, followee_profile_id)");
    expect(migration).toContain("demo_artist.demo_kind is not null");
    expect(migration).toContain("real_artist.demo_kind is null");
    // Same-account scaffolding must not ping the owner.
    expect(migration).toContain("v_follower_owner = v_followee_owner");
    expect(migration).not.toMatch(/drop table|truncate/i);

    const seed = read("lib/demo/seed.ts");
    expect(seed).toContain("ensureOwnerDemoMutualFollows");
  });
});
