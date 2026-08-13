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

  it("does not ask for a name at signup, since onboarding already does", () => {
    // Asking twice was the actual complaint: sign-up collected a name and
    // then Passage asked for it again a minute later. Onboarding keeps it,
    // because that is where there is enough context to explain what it is for.
    const page = read("app/register/page.tsx");
    expect(page).not.toContain("display-name");
    expect(page).not.toContain("normalizePersonDisplayName");
    expect(page).not.toContain("updateMyMemberProfile");
  });

  it("hands the name to Passage, which publishes it to the member profile", () => {
    const passage = read("hooks/use-passage-state.ts");
    expect(passage).toContain("normalizePersonDisplayName");
    expect(passage).toContain("updateMyMemberProfile");
    // Both exits publish it: a name given before skipping is still a name.
    expect(passage).toContain("publishName");
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
    expect(team).toContain("artist_member_profiles");
    expect(team).toContain("activatePendingTeamMember");
    expect(read("lib/team-invite-server.ts")).toContain("accepted your team invite");
    expect(track).toContain("authAccountExistsForEmail");
    expect(track).toContain("account_exists");
  });
});
