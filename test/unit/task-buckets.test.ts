import { describe, expect, it } from "vitest";
import {
  TASK_BUCKET_MOVE_HINTS,
  bucketDropId,
  bucketForDueDate,
  dropNeedsDatePrompt,
  formatBucketDateLabel,
  immediateDueDateForBucket,
  laterMinDate,
  overdueMaxDate,
  parseBucketDropId,
  weekChoiceDates,
  weekEndDate,
} from "@/lib/tasks/buckets";

const TODAY = "2026-08-12";

describe("task buckets", () => {
  it("places due dates into overdue / today / this week / later", () => {
    expect(bucketForDueDate(null, TODAY)).toBe("later");
    expect(bucketForDueDate("2026-08-11", TODAY)).toBe("overdue");
    expect(bucketForDueDate(TODAY, TODAY)).toBe("today");
    expect(bucketForDueDate("2026-08-13", TODAY)).toBe("week");
    expect(bucketForDueDate("2026-08-18", TODAY)).toBe("week");
    expect(bucketForDueDate("2026-08-19", TODAY)).toBe("later");
  });

  it("treats this week as tomorrow through today+6", () => {
    expect(weekEndDate(TODAY)).toBe("2026-08-19");
    const days = weekChoiceDates(TODAY);
    expect(days).toEqual([
      "2026-08-13",
      "2026-08-14",
      "2026-08-15",
      "2026-08-16",
      "2026-08-17",
      "2026-08-18",
    ]);
    for (const day of days) {
      expect(bucketForDueDate(day, TODAY)).toBe("week");
    }
  });

  it("bounds later and overdue pickers so a drop stays in that column", () => {
    expect(laterMinDate(TODAY)).toBe("2026-08-19");
    expect(overdueMaxDate(TODAY)).toBe("2026-08-11");
    expect(bucketForDueDate(laterMinDate(TODAY), TODAY)).toBe("later");
    expect(bucketForDueDate(overdueMaxDate(TODAY), TODAY)).toBe("overdue");
  });

  it("only today can set a due date without asking", () => {
    expect(dropNeedsDatePrompt("today")).toBe(false);
    expect(immediateDueDateForBucket("today", TODAY)).toBe(TODAY);
    expect(dropNeedsDatePrompt("week")).toBe(true);
    expect(dropNeedsDatePrompt("later")).toBe(true);
    expect(dropNeedsDatePrompt("overdue")).toBe(true);
    expect(immediateDueDateForBucket("week", TODAY)).toBeNull();
  });

  it("round-trips column drop ids", () => {
    expect(parseBucketDropId(bucketDropId("week"))).toBe("week");
    expect(parseBucketDropId("task:abc")).toBeNull();
    expect(parseBucketDropId(undefined)).toBeNull();
  });

  it("names the drop target in plain language", () => {
    expect(TASK_BUCKET_MOVE_HINTS.week).toBe("Move to this week");
    expect(TASK_BUCKET_MOVE_HINTS.today).toBe("Move to today");
    expect(TASK_BUCKET_MOVE_HINTS.later).toBe("Move to later");
    expect(TASK_BUCKET_MOVE_HINTS.overdue).toBe("Move to overdue");
  });

  it("labels a date with weekday and month", () => {
    expect(formatBucketDateLabel("2026-08-13")).toMatch(/Aug/);
    expect(formatBucketDateLabel("2026-08-13")).toMatch(/13/);
  });
});
