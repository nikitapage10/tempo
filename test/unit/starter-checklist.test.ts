import { describe, expect, it } from "vitest";
import {
  ARTIST_STARTER_CHECKLIST_IDS,
  PRO_STARTER_CHECKLIST_IDS,
} from "@/lib/api/member-onboarding";
import { starterChecklistContent } from "@/lib/starter-checklist";

describe("starter checklist content", () => {
  it("keeps the artist checklist for artists and administrators", () => {
    for (const role of ["artist", "administrator"] as const) {
      const content = starterChecklistContent(role);
      expect(content.heading).toBe("Bring the workspace to life.");
      expect(content.steps.map((step) => step.id)).toEqual(
        ARTIST_STARTER_CHECKLIST_IDS
      );
      expect(content.steps.some((step) => step.label === "Upload a tune")).toBe(
        true
      );
    }
  });

  it("gives Pros a professional checklist with no artist setup tasks", () => {
    const content = starterChecklistContent("team_member", []);
    const rendered = JSON.stringify(content);

    expect(content.steps.map((step) => step.id)).toEqual(
      PRO_STARTER_CHECKLIST_IDS
    );
    expect(rendered).toContain("professional profile");
    expect(rendered).toContain("artists you work with");
    expect(rendered).not.toContain("artist profile");
    expect(rendered).not.toContain("Upload a tune");
    expect(rendered).not.toContain("Connect Spotify");
  });

  it.each([
    [["Label owner"], "Set up your release operation.", "release checkpoint"],
    [["Collective founder"], "Set up the work around your collective.", "collective priority"],
    [["Publicist / PR"], "Set up your campaign workspace.", "campaign follow-up"],
    [["Tour manager"], "Set up the road ahead.", "show or hold"],
    [["Creative director"], "Set up your creative pipeline.", "asset handoff"],
    [["Engineer / producer"], "Set up your review flow.", "review follow-up"],
  ])("adapts the Pro checklist for %s", (roles, heading, expectedStep) => {
    const content = starterChecklistContent("team_member", roles);
    expect(content.heading).toBe(heading);
    expect(JSON.stringify(content.steps).toLowerCase()).toContain(expectedStep);
  });

  it("uses the first matching Passage role as the primary lens", () => {
    const content = starterChecklistContent("team_member", [
      "Publicist / PR",
      "Tour manager",
    ]);
    expect(content.heading).toBe("Set up your campaign workspace.");
    expect(content.personalization).toContain("Publicist / PR + Tour manager");
  });
});
