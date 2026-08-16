import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("artist plus Pro identity on one login", () => {
  it("ships an additive recovery for artists relabelled by team onboarding", () => {
    const path = "migrations/100_dual_artist_pro_identities.sql";
    expect(existsSync(resolve(path))).toBe(true);
    const migration = read(path);
    expect(migration).toContain("a.created_at < p.arrived_at");
    expect(migration).toContain("set workspace_kind = 'artist'");
    expect(migration).toContain("insert into artists");
    expect(migration).toContain("'personal'");
    expect(migration).toContain("i.member_role = 'team_member'");
    expect(migration).not.toMatch(/\bdelete\s+from\s+artists\b/i);
  });

  it("counts legacy-complete workspaces as established artists everywhere", () => {
    expect(read("lib/workspace-mode.ts")).toContain(
      'status === "legacy_complete"'
    );
    expect(read("lib/auth/origin-gate.ts")).toContain(
      'status === "legacy_complete"'
    );
  });

  it("keeps team membership additive instead of minting a second auth login", () => {
    const invite = read("app/api/team-invite/[token]/route.ts");
    const artists = read("lib/api/artists.ts");
    expect(invite).toContain("activatePendingTeamMember");
    expect(invite).toContain("userId: user.id");
    expect(artists).toContain('workspaceKind: "personal"');
    expect(artists).toContain("ownedPersonalWorkspace");
  });
});
