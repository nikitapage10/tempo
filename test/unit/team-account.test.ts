import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("team member accounts", () => {
  it("ships migration 092 for personal workspaces and teammate visibility", () => {
    expect(existsSync(resolve("migrations/092_personal_workspace_and_teammates.sql"))).toBe(
      true
    );
    const sql = read("migrations/092_personal_workspace_and_teammates.sql");
    expect(sql).toContain("workspace_kind");
    expect(sql).toContain("teammate_read_active_members");
    expect(sql).toContain("network_person_badges_for");
  });

  it("puts Team on the rail and serves it at /team", () => {
    const shell = read("components/app-shell.tsx");
    expect(shell).toContain('{ href: "/team", label: "Team"');
    expect(shell).toContain("ARTIST_NAV_CHILDREN");
    expect(shell).toContain('{ href: "/social", label: "Network"');
    expect(shell).toContain('{ href: "/profile", label: "Profile"');
    expect(shell).toContain("WORK_MAIN_NAV");
    expect(existsSync(resolve("app/(app)/team/page.tsx"))).toBe(true);
    expect(existsSync(resolve("app/(app)/profile/page.tsx"))).toBe(true);
    expect(read("app/(app)/artist/team/page.tsx")).toContain('redirect("/team")');
  });

  it("seeds a personal workspace for team members", () => {
    const artists = read("lib/api/artists.ts");
    expect(artists).toContain('workspaceKind: "personal"');
    expect(artists).toContain("tempo.preferPersonalHome");
    expect(artists).toContain("repairTeammateHomes");
  });

  it("fans rectangular team cards with the artist at the center", () => {
    const constellation = read("components/team/team-constellation.tsx");
    expect(constellation).toContain("rounded-xl");
    expect(constellation).toContain("teamFanPose");
    expect(constellation).not.toContain("orbitPosition");
    expect(read("app/(app)/team/page.tsx")).toContain("useActiveTeamRoster");
  });
});
