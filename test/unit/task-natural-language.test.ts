import { describe, expect, it } from "vitest";
import { parseNaturalTask } from "@/lib/tasks/natural-language";
import { resolveNameToId } from "@/lib/tasks/resolve";
import { nextDueDate, recurrenceExhausted } from "@/lib/tasks/recurrence";

const TODAY = "2024-01-17"; // a Wednesday

describe("task natural-language parser", () => {
  it("parses a weekday and marks urgency", () => {
    const parsed = parseNaturalTask("pitch to Sam by Friday, urgent", TODAY);
    expect(parsed.dueDate).toBe("2024-01-19");
    expect(parsed.priority).toBe(3);
    expect(parsed.assigneeName).toBeNull();
  });

  it("extracts an @person and #category tag", () => {
    const parsed = parseNaturalTask("send stems @Sam #production tomorrow", TODAY);
    expect(parsed.assigneeName).toBe("Sam");
    expect(parsed.category).toBe("production");
    expect(parsed.dueDate).toBe("2024-01-18");
    expect(parsed.title.toLowerCase()).toContain("send stems");
  });

  it("understands 'in N days'", () => {
    const parsed = parseNaturalTask("follow up in 3 days", TODAY);
    expect(parsed.dueDate).toBe("2024-01-20");
  });

  it("detects weekly recurrence", () => {
    const parsed = parseNaturalTask("post story every friday", TODAY);
    expect(parsed.recurrence).toBe("weekly");
  });

  it("detects a reminder offset", () => {
    const parsed = parseNaturalTask("submit to distributor friday, remind me a day before", TODAY);
    expect(parsed.reminderMinutes).toContain(1440);
  });

  it("defaults to a bare title with no due date when nothing is detected", () => {
    const parsed = parseNaturalTask("clean up the drive", TODAY);
    expect(parsed.dueDate).toBeNull();
    expect(parsed.priority).toBe(0);
    expect(parsed.title).toBe("clean up the drive");
  });
});

describe("resolveNameToId", () => {
  const candidates = [
    { id: "1", name: "Sam Rivera" },
    { id: "2", name: "Sam Okafor" },
    { id: "3", name: "Edit Pack Vol. 2" },
  ];

  it("resolves an exact match", () => {
    expect(resolveNameToId("Edit Pack Vol. 2", candidates)).toBe("3");
  });

  it("resolves a unique partial match case-insensitively", () => {
    expect(resolveNameToId("edit pack", candidates)).toBe("3");
  });

  it("leaves ambiguous matches unresolved", () => {
    expect(resolveNameToId("Sam", candidates)).toBeNull();
  });

  it("leaves no-match unresolved", () => {
    expect(resolveNameToId("Nobody", candidates)).toBeNull();
  });

  it("returns null for a null name", () => {
    expect(resolveNameToId(null, candidates)).toBeNull();
  });
});

describe("task recurrence math", () => {
  it("advances daily/weekly/biweekly/monthly", () => {
    expect(nextDueDate("daily", TODAY)).toBe("2024-01-18");
    expect(nextDueDate("weekly", TODAY)).toBe("2024-01-24");
    expect(nextDueDate("biweekly", TODAY)).toBe("2024-01-31");
    expect(nextDueDate("monthly", TODAY)).toBe("2024-02-17");
  });

  it("flags exhaustion past the until date", () => {
    expect(recurrenceExhausted("2024-01-24", "2024-01-20")).toBe(true);
    expect(recurrenceExhausted("2024-01-24", "2024-01-31")).toBe(false);
    expect(recurrenceExhausted("2024-01-24", null)).toBe(false);
  });
});
