import { describe, expect, it } from "vitest";
import { layoutColumns } from "@/components/calendar/calendar-week-view";
import { commonTimezones, durationMinutes, minutesFromMidnight, weekDates } from "@/lib/calendar/date";

describe("calendar week date math", () => {
  it("builds a Monday-start week", () => {
    expect(weekDates("2024-01-17", true)).toEqual([
      "2024-01-15",
      "2024-01-16",
      "2024-01-17",
      "2024-01-18",
      "2024-01-19",
      "2024-01-20",
      "2024-01-21",
    ]);
  });

  it("builds a Sunday-start week", () => {
    expect(weekDates("2024-01-17", false)).toEqual([
      "2024-01-14",
      "2024-01-15",
      "2024-01-16",
      "2024-01-17",
      "2024-01-18",
      "2024-01-19",
      "2024-01-20",
    ]);
  });

  it("resolves the same instant to different minutes across a DST boundary", () => {
    // Standard time (EST, UTC-5): 17:30 UTC -> 12:30 local.
    expect(minutesFromMidnight("2024-01-15T17:30:00.000Z", "America/New_York")).toBe(12 * 60 + 30);
    // Daylight time (EDT, UTC-4): the same wall-clock UTC time reads an hour later locally.
    expect(minutesFromMidnight("2024-07-15T17:30:00.000Z", "America/New_York")).toBe(13 * 60 + 30);
  });

  it("derives duration in minutes, defaulting to an hour with no end", () => {
    expect(durationMinutes("2024-01-15T17:00:00.000Z", "2024-01-15T18:30:00.000Z")).toBe(90);
    expect(durationMinutes("2024-01-15T17:00:00.000Z", null)).toBe(60);
  });

  it("always has a usable timezone list", () => {
    expect(commonTimezones()).toContain("UTC");
    expect(commonTimezones().length).toBeGreaterThan(5);
  });
});

describe("week grid overlap column packing", () => {
  it("keeps non-overlapping items in a single column", () => {
    const { placement, totalCols } = layoutColumns([
      { id: "a", start: 540, end: 600 },
      { id: "b", start: 600, end: 660 },
    ]);
    expect(totalCols).toBe(1);
    expect(placement.get("a")).toBe(0);
    expect(placement.get("b")).toBe(0);
  });

  it("puts overlapping items in separate columns", () => {
    const { placement, totalCols } = layoutColumns([
      { id: "a", start: 540, end: 630 },
      { id: "b", start: 570, end: 660 },
    ]);
    expect(totalCols).toBe(2);
    expect(placement.get("a")).not.toBe(placement.get("b"));
  });

  it("reuses a column once it frees up", () => {
    const { placement, totalCols } = layoutColumns([
      { id: "a", start: 540, end: 600 },
      { id: "b", start: 570, end: 630 },
      { id: "c", start: 600, end: 660 },
    ]);
    expect(totalCols).toBe(2);
    expect(placement.get("c")).toBe(placement.get("a"));
  });
});
