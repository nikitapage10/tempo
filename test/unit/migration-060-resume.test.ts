import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve("migrations/060_scene_personas.sql"), "utf8");

describe("migration 060 partial-run recovery", () => {
  it("installs the constraint-agnostic participant bridge before the membership backfill", () => {
    const bridge = sql.indexOf("create or replace function sync_scene_chat_participant() returns trigger");
    const backfill = sql.indexOf("update scene_members m\nset persona_id");
    expect(bridge).toBeGreaterThan(-1);
    expect(backfill).toBeGreaterThan(bridge);

    const bridgeBody = sql.slice(bridge, backfill);
    expect(bridgeBody).toContain("if not found then");
    expect(bridgeBody).not.toContain("on conflict (conversation_id, profile_id)");
  });

  it("deduplicates legacy account participants before adding the user constraint", () => {
    const dedupe = sql.indexOf("partition by conversation_id, user_id");
    const uniqueIndex = sql.indexOf("create unique index if not exists uq_conversation_participant_user");
    expect(dedupe).toBeGreaterThan(-1);
    expect(uniqueIndex).toBeGreaterThan(dedupe);
  });

  it("does not copy dotted legacy handles into Scene personas", () => {
    expect(sql).toContain(
      "case when ap.handle ~ '^[a-z0-9_]{2,30}$' then ap.handle else null end"
    );
  });
});
