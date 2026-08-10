import { describe, expect, it } from "vitest";
import {
  buildInAppPulse,
  buildDigestSections,
  dedupePulseItems,
  isDigestEmpty,
  labelForEmail,
  markAlreadyOnToday,
  sortPulseItems,
  type RawPulseItem,
} from "../../lib/pulse/normalize";

function item(overrides: Partial<RawPulseItem> = {}): RawPulseItem {
  return {
    dedupeIdentity: "id-1",
    category: "due",
    urgency: "today",
    genericLabel: "1 task is due",
    count: 1,
    reasonCode: "task_due",
    destination: "/tasks",
    sensitivity: "generic",
    ...overrides,
  };
}

describe("sortPulseItems", () => {
  it("orders by urgency first", () => {
    const a = item({ dedupeIdentity: "a", urgency: "soon" });
    const b = item({ dedupeIdentity: "b", urgency: "critical" });
    const sorted = sortPulseItems([a, b]);
    expect(sorted.map((i) => i.dedupeIdentity)).toEqual(["b", "a"]);
  });

  it("breaks urgency ties by due/occurred time", () => {
    const later = item({ dedupeIdentity: "later", urgency: "today", dueAt: "2026-08-12" });
    const sooner = item({ dedupeIdentity: "sooner", urgency: "today", dueAt: "2026-08-10" });
    const sorted = sortPulseItems([later, sooner]);
    expect(sorted.map((i) => i.dedupeIdentity)).toEqual(["sooner", "later"]);
  });

  it("is deterministic — repeated sorts of the same input are identical", () => {
    const items = [item({ dedupeIdentity: "x" }), item({ dedupeIdentity: "y", urgency: "critical" })];
    expect(sortPulseItems(items)).toEqual(sortPulseItems(items));
  });
});

describe("dedupePulseItems", () => {
  it("collapses items with the same dedupeIdentity, keeping the more urgent one", () => {
    const low = item({ dedupeIdentity: "same", urgency: "awareness" });
    const high = item({ dedupeIdentity: "same", urgency: "critical" });
    const result = dedupePulseItems([low, high]);
    expect(result).toHaveLength(1);
    expect(result[0].urgency).toBe("critical");
  });
});

describe("markAlreadyOnToday", () => {
  it("flags items whose identity is already shown elsewhere on Today", () => {
    const shown = new Set(["already-visible"]);
    const items = [item({ dedupeIdentity: "already-visible" }), item({ dedupeIdentity: "new" })];
    const marked = markAlreadyOnToday(items, shown);
    expect(marked.find((i) => i.dedupeIdentity === "already-visible")?.alreadyRepresentedOnToday).toBe(true);
    expect(marked.find((i) => i.dedupeIdentity === "new")?.alreadyRepresentedOnToday).toBeUndefined();
  });
});

describe("buildInAppPulse", () => {
  it("caps at 3 rows and produces a count headline", () => {
    const items = Array.from({ length: 5 }, (_, i) => item({ dedupeIdentity: `item-${i}` }));
    const result = buildInAppPulse(items, new Set());
    expect(result.items).toHaveLength(3);
    expect(result.headline).toBe("3 things changed while you were away");
    expect(result.caughtUp).toBe(false);
  });

  it("uses singular headline for exactly one item", () => {
    const result = buildInAppPulse([item()], new Set());
    expect(result.headline).toBe("One thing changed while you were away");
  });

  it("reports caughtUp and no headline when everything is already shown on Today", () => {
    const items = [item({ dedupeIdentity: "dup" })];
    const result = buildInAppPulse(items, new Set(["dup"]));
    expect(result.caughtUp).toBe(true);
    expect(result.headline).toBeNull();
    expect(result.items).toHaveLength(0);
  });

  it("reports caughtUp when there are no items at all", () => {
    const result = buildInAppPulse([], new Set());
    expect(result.caughtUp).toBe(true);
  });
});

describe("buildDigestSections", () => {
  it("groups by category in the caller-supplied order and caps detail at 5 with overflow count", () => {
    const items = Array.from({ length: 7 }, (_, i) =>
      item({ dedupeIdentity: `feedback-${i}`, category: "feedback" })
    );
    const sections = buildDigestSections(items, ["due", "feedback", "calendar"]);
    expect(sections).toHaveLength(1);
    expect(sections[0].category).toBe("feedback");
    expect(sections[0].items).toHaveLength(5);
    expect(sections[0].overflowCount).toBe(2);
  });

  it("omits empty categories entirely", () => {
    const sections = buildDigestSections([item({ category: "due" })], ["due", "feedback", "calendar"]);
    expect(sections.map((s) => s.category)).toEqual(["due"]);
  });
});

describe("isDigestEmpty", () => {
  it("is true when there is nothing actionable at all", () => {
    expect(isDigestEmpty([])).toBe(true);
  });

  it("is false when any section has content", () => {
    const sections = buildDigestSections([item()], ["due"]);
    expect(isDigestEmpty(sections)).toBe(false);
  });
});

describe("labelForEmail", () => {
  it("uses the generic label by default (privacy-default off)", () => {
    const i = item({ namedLabel: "Midnight Drive needs feedback", sensitivity: "entity_name" });
    expect(labelForEmail(i, false)).toBe(i.genericLabel);
  });

  it("uses the named label only when the member opted in and sensitivity allows it", () => {
    const i = item({ namedLabel: "Midnight Drive needs feedback", sensitivity: "entity_name" });
    expect(labelForEmail(i, true)).toBe("Midnight Drive needs feedback");
  });

  it("never uses a named label for never_email-sensitivity items, even opted in", () => {
    const i = item({ namedLabel: "should never appear", sensitivity: "never_email" });
    expect(labelForEmail(i, true)).toBe(i.genericLabel);
  });
});
