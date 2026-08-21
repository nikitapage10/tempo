import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("calendar month day cells", () => {
  const month = read("components/calendar/calendar-month-view.tsx");
  const surface = read("components/calendar/calendar-item-surface.tsx");

  it("clips day-cell items instead of nesting a scroll frame", () => {
    expect(month).toContain("overflow-hidden");
    expect(month).not.toContain("overflow-y-auto");
    expect(month).toContain("visible = dateItems.slice(0, 2)");
    expect(month).toContain("+{dateItems.length - visible.length} more");
    expect(month).toContain("onClick={() => onSelectDate(date)}");
    expect(month).toContain("cursor-pointer");
  });

  it("does not clip the cursor-edge glow on the event list itself", () => {
    expect(month).toContain('className="min-h-0 min-w-0 space-y-1"');
    expect(month).not.toContain('className="min-h-0 min-w-0 space-y-1 overflow-hidden"');
  });

  it("keeps the compact event spotlight unclipped so the edge light can travel", () => {
    expect(surface).toContain('className="relative z-0 min-w-0 max-w-full hover:z-10"');
    expect(surface).not.toContain("min-w-0 max-w-full overflow-hidden");
  });
});
