import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("membership invite signup", () => {
  it("lets a pending team or track invite token stand in for a platform invite code", () => {
    const route = read("app/api/auth/verify-invite/route.ts");
    expect(route).toContain("teamInviteToken");
    expect(route).toContain("trackInviteToken");
    expect(route).toContain("resolveTeamInvite");
    expect(route).toContain("resolveInvite");
    expect(route).toContain("That invite isn’t valid for this email.");
  });

  it("hides the invite-code field when creating an account from a team or track invite", () => {
    const page = read("app/register/page.tsx");
    expect(page).toContain("parseInviteRedirect");
    expect(page).toContain("teamInviteToken");
    expect(page).toContain("trackInviteToken");
    expect(page).toContain("needsCode");
    expect(page).toContain("Create an account to work with");
    expect(page).not.toContain("function isSafeRedirect");
  });

  it("replaces Sign in to accept with Create an account when the invited email is new", () => {
    const cta = read("components/auth/invite-auth-cta.tsx");
    expect(cta).toContain("Create an account");
    expect(cta).toContain("Sign in to accept");
    expect(cta).toContain("accountExists === false");
    expect(cta).toContain("Already have an account? Sign in");
  });

  it("tells the invite preview whether that email already has a TEMPO account", () => {
    const team = read("app/api/team-invite/[token]/route.ts");
    const track = read("app/api/invite/[token]/route.ts");
    expect(team).toContain("authAccountExistsForEmail");
    expect(team).toContain("account_exists");
    expect(track).toContain("authAccountExistsForEmail");
    expect(track).toContain("account_exists");
  });
});
