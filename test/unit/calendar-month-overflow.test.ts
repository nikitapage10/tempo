import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("calendar month day cells", () => {
  const month = read("components/calendar/calendar-month-view.tsx");

  it("clips day-cell items instead of nesting a scroll frame", () => {
    expect(month).toContain("overflow-hidden");
    expect(month).not.toContain("overflow-y-auto");
    expect(month).toContain("visible = dateItems.slice(0, 3)");
    expect(month).toContain("+{dateItems.length - visible.length} more");
  });
});
