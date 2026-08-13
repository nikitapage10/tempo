import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("existing TEMPO team invites", () => {
  it("ships migration 097 so one person cannot be invited twice", () => {
    expect(existsSync(resolve("migrations/097_team_member_existing_invites.sql"))).toBe(
      true
    );
    const sql = read("migrations/097_team_member_existing_invites.sql");
    expect(sql).toContain("artist_members_pending_email");
    expect(sql).toContain("artist_members_pending_user");
    expect(sql).toContain("artist_members_active_user");
  });

  it("creates team invites on the server from email, handle, or profile", () => {
    const create = read("lib/team/create-member-invite.ts");
    expect(create).toContain("authUserByEmail");
    expect(create).toContain("type: \"team_invite\"");
    expect(create).toContain('kind: "existing" | "email"');
    expect(create).toContain("eq(\"handle\", handle)");
    const route = read("app/api/team-invite/create/route.ts");
    expect(route).toContain("createMemberInvite");
    expect(read("lib/api/artist-members.ts")).toContain("/api/team-invite/create");
  });

  it("lets the invited person approve or decline from Team", () => {
    const respond = read("app/api/team-invite/respond/route.ts");
    expect(respond).toContain("activatePendingTeamMember");
    expect(respond).toContain("declinePendingTeamMember");
    expect(respond).toContain("member.user_id !== user.id");
    expect(read("components/team/pending-team-invites.tsx")).toContain("Approve");
    expect(read("components/team/pending-team-invites.tsx")).toContain("Decline");
    expect(read("app/(app)/team/page.tsx")).toContain("PendingTeamInvites");
    expect(read("lib/notifications/href.ts")).toContain('n.type === "team_invite"');
  });

  it("offers handle or email on the artist team invite form", () => {
    const manager = read("components/team/team-manager.tsx");
    expect(manager).toContain("Handle or email");
    expect(manager).toContain("searchArtistProfiles");
    expect(manager).toContain("profileId");
    expect(manager).toContain("waiting for them to approve");
  });
});
