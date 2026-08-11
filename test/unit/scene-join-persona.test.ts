import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Scene join compatibility", () => {
  const source = readFileSync(resolve("lib/api/scenes.ts"), "utf8");
  const start = source.indexOf("export async function joinScene(");
  const end = source.indexOf("export async function leaveScene(", start);
  const joinSource = source.slice(start, end);

  it("joins through the account-level Scene persona RPCs", () => {
    expect(joinSource).toContain('rpc(\n    "ensure_scene_persona"');
    expect(joinSource).toContain('rpc("join_scene_v2"');
    expect(joinSource).toContain("p_persona_id");
  });

  it("does not call the removed profile-level conflict path", () => {
    expect(joinSource).not.toContain('rpc("join_scene"');
    expect(joinSource).not.toContain("p_profile_id: profileId");
  });
});
