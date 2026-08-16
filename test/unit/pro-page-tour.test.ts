import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const tour = readFileSync(resolve("components/onboarding/contextual-page-tour.tsx"), "utf8");
const choice = readFileSync(resolve("components/onboarding/pro-tour-choice.tsx"), "utf8");
const guided = readFileSync(resolve("components/guided-tour.tsx"), "utf8");
const onboardingRoute = readFileSync(resolve("app/api/onboarding/route.ts"), "utf8");
const migration = readFileSync(resolve("migrations/099_pro_tour_persistence.sql"), "utf8");

describe("Pro page tours", () => {
  it("covers every page in the Pro rail", () => {
    const shell = readFileSync(resolve("components/app-shell.tsx"), "utf8");
    const workNav = shell.slice(
      shell.indexOf("const WORK_MAIN_NAV"),
      shell.indexOf("const WORK_MOBILE_NAV")
    );
    const hrefs = Array.from(workNav.matchAll(/href: "([^"]+)"/g)).map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThan(0);

    const proTours = tour.slice(tour.indexOf("const PRO_TOURS"), tour.indexOf("function tourFor"));
    for (const href of hrefs) {
      expect(proTours, `no Pro tour for ${href}`).toContain(`"${href}":`);
    }
  });

  it("keeps Pro tour ids distinct from the artist ones", () => {
    // Shared ids would mean taking one set marked the other as already seen.
    const proTours = tour.slice(tour.indexOf("const PRO_TOURS"), tour.indexOf("function tourFor"));
    const ids = Array.from(proTours.matchAll(/id: "([^"]+)"/g)).map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(id.startsWith("pro-")).toBe(true);
  });

  it("gates Pro page guides behind an explicit Pro choice", () => {
    expect(tour).toContain('onboarding.data?.proTourChoice === "guides"');
    expect(choice).toContain('mode === "work"');
    expect(choice).toContain('memberRole === "team_member"');
    expect(choice).toContain("!onboarding.data.proTourChoice");
    expect(choice).toContain("Show me the Pro guides");
    expect(choice).toContain("Skip all tours");
    expect(choice).toContain('proTourChoice: skipAllPageTours ? "skip_all" : "guides"');
  });

  it("persists the Pro decision independently from the artist introduction", () => {
    expect(migration).toContain("add column if not exists pro_tour_choice text");
    expect(migration).toContain("member_onboarding_pro_tour_choice_check");
    expect(migration).toContain("where member_role = 'team_member'");
    expect(onboardingRoute).toContain("patch.pro_tour_choice = body.proTourChoice");
    expect(onboardingRoute).toContain("PRO_PAGE_TOUR_IDS");
  });

  it("never opens the artist introduction over a Pro workspace", () => {
    expect(guided).toContain('mode !== "artist"');
    expect(guided).toContain("if (isLoading");
    expect(guided).toContain('setPhase("hidden")');
  });

  it("clears an Origin handoff when the signed-in account changes", () => {
    const reset = readFileSync(resolve("lib/auth/reset-client-session.ts"), "utf8");
    expect(reset).toContain("GUIDED_TOUR_PENDING_KEY");
    expect(reset).toContain("accountScopedSessionKeys");
  });

  it("never prefix-matches every route on the Today tour", () => {
    expect(tour).toContain('path !== "/"');
  });

  it("picks the set from the workspace shell", () => {
    expect(tour).toContain("useWorkspaceMode");
    expect(tour).toContain('mode === "work"');
  });

  it("mounts the Pro choice before contextual page tours", () => {
    const shell = readFileSync(resolve("components/app-shell.tsx"), "utf8");
    expect(shell.indexOf("<ProTourChoice />")).toBeLessThan(
      shell.indexOf("<ContextualPageTour />")
    );
  });

  it("includes Pro ids when Skip all tours is saved", () => {
    const ids = readFileSync(resolve("lib/api/member-onboarding.ts"), "utf8");
    expect(ids).toContain('"pro-today"');
    expect(ids).toContain('"pro-settings"');
    expect(ids).toContain("...PRO_PAGE_TOUR_IDS");
    expect(onboardingRoute).toContain("new Set<string>(PAGE_TOUR_IDS)");
  });
});
