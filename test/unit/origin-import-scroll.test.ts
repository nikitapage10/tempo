import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("Origin Shape the Workspace scroll", () => {
  const story = read("components/origin/origin-story-scroll.tsx");
  const experience = read("components/origin/origin-experience.tsx");

  it("scrolls import review inside the chapter body instead of a nested 72dvh clip", () => {
    expect(story).toContain("origin-import-scroll");
    expect(story).toContain("scrollBody");
    expect(story).not.toContain("max-h-[72dvh]");
    expect(story).toContain("items-stretch overflow-hidden py-4 sm:py-5");
  });

  it("top-aligns the import panel so Continue is reachable", () => {
    expect(story).toContain('translate3d(0, 0, 0) scale(1)');
    expect(story).toContain('el.style.top = own ? "0" : ""');
    expect(story).toContain("top-0 bottom-0");
  });

  it("pauses desktop CSS zoom while import owns the stage", () => {
    expect(story).toContain("onImportActiveChange");
    expect(experience).toContain("importUiActive");
    expect(experience).toContain("contentZoom !== 1 && !importUiActive");
  });
});
