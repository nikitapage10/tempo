import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("tracks list drag", () => {
  it("slides rows without scaling and without extra layout tweens", () => {
    const page = read("app/(app)/tracks/page.tsx");
    expect(page).toContain("CSS.Translate.toString(transform)");
    expect(page).toContain("animateLayoutChanges: () => false");
    expect(page).toContain("DragOverlay");
    expect(page).not.toContain("CSS.Transform.toString(transform)");
  });
});
