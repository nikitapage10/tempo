import { describe, expect, it } from "vitest";
import { clientForRole, anonClient, loadFixtureManifest } from "../support/fixture-clients";

/**
 * Direct RLS assertions against the isolated test Supabase project, using
 * real signed-in sessions for each fixture role (test/support/seed-fixtures.mjs).
 * Mirrors the permissions matrix in SECURITY-AND-PERMISSIONS.md §3. A failure
 * here means real cross-account/RLS exposure — release blocker per
 * planning/03-IMPLEMENTATION-TEST-ROLLOUT-PLAN.md AR-2.
 */

const manifest = loadFixtureManifest();
const { trackId } = manifest;

describe("track read access", () => {
  it("owner can read their track", async () => {
    const client = await clientForRole("owner");
    const { data, error } = await client.from("tracks").select("id").eq("id", trackId).maybeSingle();
    expect(error).toBeNull();
    expect(data?.id).toBe(trackId);
  });

  for (const role of ["editor", "uploader", "commenter", "viewer"] as const) {
    it(`${role} collaborator can read the shared track`, async () => {
      const client = await clientForRole(role);
      const { data, error } = await client.from("tracks").select("id").eq("id", trackId).maybeSingle();
      expect(error).toBeNull();
      expect(data?.id).toBe(trackId);
    });
  }

  it("an unrelated account cannot read the track (RLS filters silently)", async () => {
    const client = await clientForRole("unauthorized");
    const { data, error } = await client.from("tracks").select("id").eq("id", trackId).maybeSingle();
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("an anonymous client cannot read the track", async () => {
    const client = anonClient();
    const { data, error } = await client.from("tracks").select("id").eq("id", trackId).maybeSingle();
    expect(error).toBeNull();
    expect(data).toBeNull();
  });
});

describe("track write access", () => {
  it("owner can edit track metadata", async () => {
    const client = await clientForRole("owner");
    const { error } = await client
      .from("tracks")
      .update({ notes: `owner-edit ${Date.now()}` })
      .eq("id", trackId);
    expect(error).toBeNull();
  });

  it("editor collaborator can edit track metadata", async () => {
    const client = await clientForRole("editor");
    const { error } = await client
      .from("tracks")
      .update({ notes: `editor-edit ${Date.now()}` })
      .eq("id", trackId);
    expect(error).toBeNull();
  });

  for (const role of ["uploader", "commenter", "viewer"] as const) {
    it(`${role} cannot edit track metadata`, async () => {
      const client = await clientForRole(role);
      const before = await client.from("tracks").select("notes").eq("id", trackId).maybeSingle();
      const { error } = await client
        .from("tracks")
        .update({ notes: `${role}-should-not-apply ${Date.now()}` })
        .eq("id", trackId);
      // RLS blocks either via error or a silently-matched-zero-rows update;
      // assert the value never actually changed either way.
      const after = await client.from("tracks").select("notes").eq("id", trackId).maybeSingle();
      expect(after.data?.notes).toBe(before.data?.notes);
      void error;
    });
  }

  it("unauthorized account cannot edit the track", async () => {
    const client = await clientForRole("unauthorized");
    const before = await clientForRoleSnapshot();
    const { error } = await client
      .from("tracks")
      .update({ notes: "unauthorized-should-not-apply" })
      .eq("id", trackId);
    void error;
    const owner = await clientForRole("owner");
    const after = await owner.from("tracks").select("notes").eq("id", trackId).maybeSingle();
    expect(after.data?.notes).toBe(before);
  });
});

async function clientForRoleSnapshot(): Promise<string | null | undefined> {
  const owner = await clientForRole("owner");
  const { data } = await owner.from("tracks").select("notes").eq("id", trackId).maybeSingle();
  return data?.notes;
}

describe("version upload access", () => {
  it("uploader can insert a version", async () => {
    const client = await clientForRole("uploader");
    const { error } = await client.from("versions").insert({
      track_id: trackId,
      file_url: `fixtures/rls-test/${Date.now()}.mp3`,
    });
    expect(error).toBeNull();
  });

  for (const role of ["commenter", "viewer"] as const) {
    it(`${role} cannot insert a version`, async () => {
      const client = await clientForRole(role);
      const { error } = await client.from("versions").insert({
        track_id: trackId,
        file_url: `fixtures/rls-test/${role}-${Date.now()}.mp3`,
      });
      expect(error).not.toBeNull();
    });
  }
});

describe("comment access", () => {
  it("commenter can post a comment", async () => {
    const client = await clientForRole("commenter");
    const { error } = await client.from("comments").insert({
      track_id: trackId,
      version_id: manifest.versionId,
      text: "RLS test comment from commenter",
    });
    expect(error).toBeNull();
  });

  it("viewer cannot post a comment", async () => {
    const client = await clientForRole("viewer");
    const { error } = await client.from("comments").insert({
      track_id: trackId,
      version_id: manifest.versionId,
      text: "should be rejected",
    });
    expect(error).not.toBeNull();
  });
});

describe("cross-track enumeration", () => {
  it("unauthorized account cannot enumerate tracks by guessing IDs", async () => {
    const client = await clientForRole("unauthorized");
    const { data, error } = await client.from("tracks").select("id");
    expect(error).toBeNull();
    expect(data?.some((t) => t.id === trackId)).toBe(false);
  });
});
