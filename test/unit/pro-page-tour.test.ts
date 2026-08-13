import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const tour = readFileSync(resolve("components/onboarding/contextual-page-tour.tsx"), "utf8");

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

  it("does not gate Pros behind the artist main tour", () => {
    // mainTourCompletedAt is only ever set by the post-Origin tour, which a
    // Pro never runs, so requiring it meant they were offered nothing at all.
    expect(tour).toContain("const introDone = isPro ? true :");
  });

  it("never prefix-matches every route on the Today tour", () => {
    expect(tour).toContain('path !== "/"');
  });

  it("picks the set from the workspace shell", () => {
    expect(tour).toContain("useWorkspaceMode");
    expect(tour).toContain('mode === "work"');
  });
});
