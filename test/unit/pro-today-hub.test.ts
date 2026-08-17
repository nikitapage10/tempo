import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  excludePersonalHomeWork,
  nextWorkByArtist,
  pickWaitingOnYou,
  rankWaitingOnYou,
  sortProHubArtists,
  WAITING_ON_YOU_LIMIT,
} from "@/lib/today/pro-hub";

const read = (path: string) => readFileSync(resolve(path), "utf8");

function work(partial: {
  artistId: string;
  urgency: "overdue" | "today" | "review_requested" | "upcoming" | "open";
  dueAt?: string | null;
  updatedAt?: string;
  title?: string;
}) {
  return {
    title: partial.title ?? partial.artistId,
    dueAt: partial.dueAt ?? null,
    updatedAt: partial.updatedAt ?? "2026-08-17T12:00:00.000Z",
    ...partial,
  };
}

describe("Pro Today hub", () => {
  it("keeps personal-home tasks out of Waiting on you", () => {
    expect(
      excludePersonalHomeWork(
        [work({ artistId: "home", urgency: "today" }), work({ artistId: "artist", urgency: "overdue" })],
        "home"
      ).map((item) => item.artistId)
    ).toEqual(["artist"]);
  });

  it("surfaces the most urgent assigned work first, capped", () => {
    const picked = pickWaitingOnYou([
      work({ artistId: "a", urgency: "open", updatedAt: "2026-08-16T00:00:00.000Z" }),
      work({ artistId: "b", urgency: "upcoming", dueAt: "2026-08-20" }),
      work({ artistId: "c", urgency: "today", dueAt: "2026-08-17" }),
      work({ artistId: "d", urgency: "overdue", dueAt: "2026-08-15" }),
      work({ artistId: "e", urgency: "review_requested" }),
      work({ artistId: "f", urgency: "overdue", dueAt: "2026-08-14" }),
    ]);
    expect(picked.map((item) => item.artistId)).toEqual(["f", "d", "c", "e"]);
    expect(picked).toHaveLength(WAITING_ON_YOU_LIMIT);
  });

  it("pins one waiting item to each artist and sorts roster by attention", () => {
    const items = rankWaitingOnYou([
      work({ artistId: "northstar", urgency: "overdue", title: "Send stems" }),
      work({ artistId: "northstar", urgency: "today", title: "Later" }),
      work({ artistId: "president", urgency: "upcoming", title: "Campaign review" }),
    ]);
    const next = nextWorkByArtist(items);
    expect(next.get("northstar")?.title).toBe("Send stems");
    expect(next.get("president")?.title).toBe("Campaign review");

    expect(
      sortProHubArtists([
        { name: "Quiet", overdue: 0, hasWaitingWork: false },
        { name: "Kai", overdue: 0, hasWaitingWork: true },
        { name: "PRESIDENT", overdue: 2, hasWaitingWork: false },
      ]).map((row) => row.name)
    ).toEqual(["PRESIDENT", "Kai", "Quiet"]);
  });

  it("still peeks waiting work on artist cards beyond the Today cap", () => {
    const items = rankWaitingOnYou([
      work({ artistId: "a", urgency: "overdue" }),
      work({ artistId: "b", urgency: "overdue" }),
      work({ artistId: "c", urgency: "today" }),
      work({ artistId: "d", urgency: "today" }),
      work({ artistId: "e", urgency: "upcoming", title: "Hold the date" }),
    ]);
    expect(pickWaitingOnYou(items).map((item) => item.artistId)).toEqual(["a", "b", "c", "d"]);
    expect(nextWorkByArtist(items).get("e")?.title).toBe("Hold the date");
  });

  it("mounts the hub on Pro Today without replacing open tasks and projects", () => {
    const page = read("app/(app)/page.tsx");
    expect(page).toContain("ProTodayHub");
    expect(page).toContain('mode === "work"');
    expect(page).toContain("isProHome");
    expect(page).toContain("Open tasks");
    expect(page).toContain("Projects");
    expect(page.indexOf("<TasksFocusPanels")).toBeLessThan(page.indexOf("<ProTodayHub"));
  });

  it("points the Pro Today tour at the roster hub", () => {
    const tour = read("components/onboarding/contextual-page-tour.tsx");
    const hub = read("components/today/pro-today-hub.tsx");
    expect(hub).toContain('data-tour="pro-today-hub"');
    expect(hub).toContain("Waiting on you");
    expect(hub).toContain("Artists you work with");
    expect(tour).toContain("main [data-tour='pro-today-hub']");
  });
});
