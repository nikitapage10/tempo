import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("tracks list drag", () => {
  it("uses Board-style draggable rows and a layout-slide drop", () => {
    const page = read("app/(app)/tracks/page.tsx");
    expect(page).toContain("useDraggable");
    expect(page).toContain("useDroppable");
    expect(page).toContain('useLayoutMove(`tracks-row-${track.id}`)');
    expect(page).toContain('LayoutGroup id="tempo-tracks-list"');
    expect(page).toContain("dropAnimation={null}");
    expect(page).toContain("itemTargetId(\"track\", track.id)");
    expect(page).toContain("DropIndicator");
    expect(page).toContain("listInsertCollision");
    expect(page).toContain("collisionDetection={tracksCollision}");
    expect(page).not.toContain("useSortable");
    expect(page).not.toContain("SortableContext");
    expect(page).not.toContain("CSS.Translate");
    expect(page).not.toContain("CSS.Transform");
  });
});
