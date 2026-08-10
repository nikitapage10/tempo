import { describe, expect, it } from "vitest";
import {
  DEFAULT_CALENDAR_CATEGORIES,
  categoryKeyForItem,
  mergeCalendarCategories,
  normalizeCategoryColor,
} from "@/lib/calendar/categories";

describe("calendar categories", () => {
  it("ships distinct defaults for every native schedule type", () => {
    const keys = DEFAULT_CALENDAR_CATEGORIES.map((category) => category.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("live_show");
    expect(keys).toContain("release_date");
    expect(new Set(DEFAULT_CALENDAR_CATEGORIES.map((category) => category.color)).size)
      .toBe(DEFAULT_CALENDAR_CATEGORIES.length);
  });

  it("merges saved overrides and custom event categories", () => {
    const merged = mergeCalendarCategories([
      { key: "meeting", label: "Band meeting", color: "#123456", group: "event", sort: 110, locked: false },
      { key: "custom_listening", label: "Listening party", color: "#654321", group: "event", sort: 220, locked: false },
    ]);
    expect(merged.find((category) => category.key === "meeting")).toMatchObject({ label: "Band meeting", color: "#123456", locked: true });
    expect(merged.find((category) => category.key === "custom_listening")).toMatchObject({ label: "Listening party", locked: false });
  });

  it("maps custom events to their kind and normalizes invalid colors", () => {
    expect(categoryKeyForItem("custom_event", "live_show")).toBe("live_show");
    expect(categoryKeyForItem("task_due", null)).toBe("task_due");
    expect(normalizeCategoryColor("not-a-color")).toBe("#a78bfa");
  });
});
