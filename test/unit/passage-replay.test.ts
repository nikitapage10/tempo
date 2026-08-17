import { describe, expect, it } from "vitest";
import { passageVisitAllowed } from "@/lib/auth/passage-gate";
import { passageResumeForVisit } from "@/lib/passage/resume";
import { clearedProTourProgress } from "@/lib/api/member-onboarding";
import type { MemberPassage } from "@/lib/passage/types";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(path), "utf8");

const saved: MemberPassage = {
  status: "complete",
  currentStep: "complete",
  displayName: "Jordan",
  roleTitles: ["manager"],
  roleTitleOther: null,
  entryText: "A&R first.",
  supportsText: "Independent artists.",
  functionText: "Day-to-day management.",
  interpretation: {
    headline: "A manager in the room",
    intro: "Jordan keeps the work moving.",
    storySections: [],
  },
  completedAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

describe("passageResumeForVisit", () => {
  it("ignores a finished row on a first-run visit", () => {
    expect(passageResumeForVisit(saved)).toBeNull();
  });

  it("resumes only an unfinished draft on a first-run visit", () => {
    const draft = { ...saved, status: "in_progress" as const, currentStep: "entry" as const };
    expect(passageResumeForVisit(draft)?.currentStep).toBe("entry");
  });

  it("opens a revisit on the closing story with the saved answers", () => {
    const resume = passageResumeForVisit(saved, { revisit: true });
    expect(resume?.currentStep).toBe("story");
    expect(resume?.displayName).toBe("Jordan");
    expect(resume?.roleTitles).toEqual(["manager"]);
  });

  it("starts a replay from the top even when a complete row exists", () => {
    expect(passageResumeForVisit(saved, { replay: true })).toBeNull();
    expect(
      passageResumeForVisit(
        { ...saved, status: "in_progress", currentStep: "look" },
        { replay: true, revisit: true },
      ),
    ).toBeNull();
  });
});

describe("passageVisitAllowed", () => {
  it("lets a Pro into an unfinished Passage", () => {
    expect(
      passageVisitAllowed({
        isTeamMember: true,
        passageStatus: "in_progress",
      }),
    ).toBe(true);
  });

  it("keeps a finished Pro out unless they asked", () => {
    expect(
      passageVisitAllowed({
        isTeamMember: true,
        passageStatus: "complete",
      }),
    ).toBe(false);
    expect(
      passageVisitAllowed({
        isTeamMember: true,
        passageStatus: "complete",
        revisit: true,
      }),
    ).toBe(true);
    expect(
      passageVisitAllowed({
        isTeamMember: true,
        passageStatus: "skipped",
        replay: true,
      }),
    ).toBe(true);
  });

  it("never offers Passage to someone who is not a Pro", () => {
    expect(
      passageVisitAllowed({
        isTeamMember: false,
        passageStatus: null,
        replay: true,
      }),
    ).toBe(false);
  });
});

describe("clearedProTourProgress", () => {
  it("drops Pro guide progress and keeps artist tours", () => {
    const cleared = clearedProTourProgress({
      pageToursCompleted: ["calendar", "pro-today", "pro-tasks"],
      pageToursSkipped: ["settings", "pro-settings"],
    });
    expect(cleared.pageToursCompleted).toEqual(["calendar"]);
    expect(cleared.pageToursSkipped).toEqual(["settings"]);
  });
});

describe("Passage Settings replay wiring", () => {
  it("offers Open and Replay on a Pro home, matching Artist Origin", () => {
    const settings = read("app/(app)/settings/page.tsx");
    expect(settings).toContain('title="Passage"');
    expect(settings).toContain('href="/passage?revisit=1"');
    expect(settings).toContain('secondaryHref="/passage?replay=1"');
    expect(settings).toContain('secondaryCta="Replay introduction"');
    expect(settings).toContain('cta="Open Passage"');
  });

  it("lets a finished Passage reopen from Settings query flags", () => {
    const page = read("app/(onboarding)/passage/page.tsx");
    const hook = read("hooks/use-passage-state.ts");
    const experience = read("components/passage/passage-experience.tsx");
    const route = read("app/api/onboarding/route.ts");

    expect(page).toContain("searchParams.revisit === \"1\"");
    expect(page).toContain("searchParams.replay === \"1\"");
    expect(page).toContain("passageVisitAllowed");
    expect(hook).toContain("passageResumeForVisit");
    expect(experience).toContain("usePassageState(revisit, replay)");
    expect(experience).toContain("resetProTour: true");
    expect(route).toContain("body.resetProTour === true");
  });
});
