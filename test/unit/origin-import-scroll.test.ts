import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("Origin Shape the Workspace scroll", () => {
  const story = read("components/origin/origin-story-scroll.tsx");
  const experience = read("components/origin/origin-experience.tsx");
  const spotify = read("components/import/spotify-catalog-step.tsx");
  const intake = read("components/import/intake-canvas.tsx");

  it("scrolls import review inside the chapter body instead of a nested 72dvh clip", () => {
    expect(story).toContain("origin-import-scroll");
    expect(story).toContain("scrollBody");
    expect(story).not.toContain("max-h-[72dvh]");
    expect(story).toContain("grid-rows-[minmax(0,1fr)]");
  });

  it("centres the import panel and lets it size to its own content", () => {
    // Every chapter, import included, is centred by the same
    // top-1/2 + translateY(-50%) pair rather than pinned to the stage edges.
    expect(story).toContain("translate3d(0, -50%, 0) scale(1)");
    expect(story).toContain("flex items-center overflow-hidden px-5");
    expect(story).not.toContain("items-stretch");
    // Stretching the panel top-to-bottom drew a full-height sheet of glass
    // around steps that are a single small card.
    expect(story).not.toContain("top-4 bottom-4 sm:top-5 sm:bottom-5");
    expect(story).not.toContain('el.style.top = own ? "1rem" : ""');
    // Only the steps with genuinely wide content get the wider glass.
    expect(story).toContain("importWide");
  });

  it("lets ordinary story chapters scroll inside their max-height instead of clipping", () => {
    expect(story).toContain("CHAPTER_MAX");
    expect(story).toContain("CHAPTER_BODY");
    expect(story).toContain("spectra-scrollbar");
    expect(story).not.toContain("max-h-[min(calc(100dvh-5rem),52rem)] overflow-x-hidden overflow-y-auto");
    expect(story).not.toContain("index === STORY_CHAPTER");
  });

  it("pauses desktop CSS zoom while import owns the stage", () => {
    expect(story).toContain("onImportActiveChange");
    expect(experience).toContain("importUiActive");
    expect(experience).toContain("contentZoom !== 1 && !importUiActive");
    expect(experience).toContain("--origin-zoom");
  });

  it("keeps the Spotify match list inside the chapter and pins the actions", () => {
    expect(spotify).toContain("origin-spotify-matches");
    expect(spotify).toContain("embedded &&");
    expect(spotify).toContain("sticky bottom-0");
  });

  it("caps the embedded intake canvas so it fits with chapter chrome", () => {
    expect(intake).toContain("h-[min(52dvh,36rem)]");
    expect(intake).not.toContain("h-[min(66dvh,42rem)]");
  });
});

describe("Origin and Passage overlay fit", () => {
  const overlay = read("components/origin/origin-copy-layer.tsx");
  const intro = read("components/origin/origin-introduction-step.tsx");
  const direction = read("components/origin/origin-direction-step.tsx");
  const look = read("components/origin/origin-look-step.tsx");
  const passageText = read("components/passage/passage-text-step.tsx");
  const passageDescribe = read("components/passage/passage-describe-step.tsx");
  const passageStory = read("components/passage/passage-story-scroll.tsx");

  it("scrolls the overlay from the top instead of centering a clipped panel", () => {
    expect(overlay).toContain("overflow-y-auto");
    expect(overlay).toContain("grow basis-0");
    expect(overlay).not.toContain("place-items-center");
    expect(overlay).toContain("ORIGIN_FIT_SHELL");
    expect(overlay).toContain("ORIGIN_FIT_BODY");
    expect(overlay).toContain("ORIGIN_FIT_FOOTER");
  });

  it("centres each step in the shared grid cell and keeps it middle-right", () => {
    // Every step shares one grid cell so they can crossfade in place, and
    // steps stay mounted at opacity 0 either side of their turn. Without an
    // explicit align, the default `stretch` sized a single line of copy to the
    // height of the invisible panel beside it and rendered it at the top of
    // that box, which pinned the opening lines to the top of the screen.
    expect(overlay).toContain("items-center justify-items-stretch sm:justify-items-end");
    expect(overlay).toContain("sm:pr-[14vw]");
    expect(overlay).not.toContain("justify-items-center");
  });

  it("caps every tall question panel and keeps actions in a footer", () => {
    for (const source of [intro, direction, look, passageText, passageDescribe]) {
      expect(source).toContain("ORIGIN_FIT_SHELL");
      expect(source).toContain("ORIGIN_FIT_BODY");
      expect(source).toContain("ORIGIN_FIT_FOOTER");
    }
  });

  it("lets Passage story chapters scroll inside the stage", () => {
    expect(passageStory).toContain("overflow-hidden");
    expect(passageStory).toContain("spectra-scrollbar");
    expect(passageStory).not.toContain("max-h-[min(calc(100dvh-5rem),52rem)] overflow-x-hidden overflow-y-auto");
  });
});
