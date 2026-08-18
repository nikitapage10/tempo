import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("tracks list drag", () => {
  it("uses the same layout-slide drop as the Board", () => {
    const page = read("app/(app)/tracks/page.tsx");
    expect(page).toContain('useLayoutMove(`tracks-row-${track.id}`)');
    expect(page).toContain('LayoutGroup id="tempo-tracks-list"');
    expect(page).toContain("dropAnimation={null}");
    expect(page).toContain("animateLayoutChanges: () => false");
    expect(page).toContain("overlay");
    expect(page).not.toContain("CSS.Translate");
    expect(page).not.toContain("CSS.Transform");
  });
});
