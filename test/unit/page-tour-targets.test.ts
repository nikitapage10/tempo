import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const tour = readFileSync(resolve("components/onboarding/contextual-page-tour.tsx"), "utf8");
const shell = readFileSync(resolve("components/app-shell.tsx"), "utf8");
const sessions = readFileSync(resolve("app/(app)/sessions/page.tsx"), "utf8");

/** Every `data-tour="..."` name the app actually renders. */
function declaredAnchors(): Set<string> {
  const found = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }
      if (!entry.endsWith(".tsx")) continue;
      const matches = Array.from(readFileSync(path, "utf8").matchAll(/data-tour="([^"]+)"/g));
      for (const match of matches) found.add(match[1]);
    }
  };
  walk(resolve("app"));
  walk(resolve("components"));
  return found;
}

describe("page tour targets", () => {
  it("searches the page, not the shell chrome around it", () => {
    expect(shell).toContain("data-page-content");
    expect(tour).toContain('document.querySelector<HTMLElement>("[data-page-content]")');
    expect(tour).toContain("if (page && !page.contains(element)) return false;");
  });

  it("keeps the toolbar ahead of the page, which is why scoping matters", () => {
    // The bell, messages, profile, and search all render inside `main` before
    // the page does, so an unscoped selector list resolves to them first.
    expect(shell.indexOf("<NotificationCenter />")).toBeLessThan(
      shell.indexOf("data-page-content")
    );
  });

  it("points every step at an anchor the app really renders", () => {
    const used = Array.from(tour.matchAll(/anchor\("([^"]+)"\)/g)).map((m) => m[1]);
    expect(used.length).toBeGreaterThan(15);
    const declared = declaredAnchors();
    for (const name of used) {
      expect(declared, `no element declares data-tour="${name}"`).toContain(name);
    }
  });

  it("never guesses with an element or class selector", () => {
    // A selector list resolves in document order, not in the order it was
    // written, so a loose fallback quietly wins over the intended target.
    const selectors = Array.from(tour.matchAll(/selector: (['"])(.*?)\1/g)).map((m) => m[2]);
    for (const selector of selectors) {
      expect(selector, `${selector} guesses at the page`).toMatch(
        /^main \[(data-|aria-|role=)|^main #/
      );
      expect(selector).not.toContain(".panel");
      expect(selector).not.toContain("class*=");
    }
  });

  it("points the Sessions step at the control that creates a session", () => {
    expect(sessions).toContain('data-tour="session-create"');
    const artist = tour.slice(tour.indexOf('"/sessions": {'), tour.indexOf('"/stats": {'));
    const pro = tour.slice(tour.lastIndexOf('"/sessions": {'), tour.lastIndexOf('"/settings": {'));
    for (const steps of [artist, pro]) {
      expect(steps).toContain('anchor("session-create")');
    }
  });

  it("drops a step about content the page does not have yet", () => {
    const card = readFileSync(resolve("components/sessions/session-card.tsx"), "utf8");
    expect(card).toContain('data-tour="session-room"');
    const artist = tour.slice(tour.indexOf('"/sessions": {'), tour.indexOf('"/stats": {'));
    expect(artist).toContain('anchor("session-room")');
    expect(artist).toContain("needsTarget: true");
    expect(tour).toContain("!step.needsTarget || findTarget(step)");
  });

  it("counts the steps it will actually show", () => {
    expect(tour).toContain("setSteps(stepsForPage(tour))");
    expect(tour).toContain("const step = steps[stepIndex];");
    expect(tour).toContain("const isLast = stepIndex === steps.length - 1;");
    expect(tour).toContain('String(steps.length).padStart(2, "0")');
  });

  it("anchors the pages the demo artist sees instead of the normal ones", () => {
    // Scenes and Social swap in a read-only demo surface for the shared demo
    // artist. Anchoring only the real view left those two tours pointing at
    // whatever the page happened to contain.
    for (const [file, anchors] of [
      ["components/demo/demo-scenes-view.tsx", ["scene-open"]],
      ["components/demo/demo-social-view.tsx", ["social-people"]],
    ] as const) {
      const source = readFileSync(resolve(file), "utf8");
      for (const name of anchors) {
        expect(source, `${file} is missing data-tour="${name}"`).toContain(`data-tour="${name}"`);
      }
    }
  });

  it("anchors both ways a board can be shown", () => {
    // The board has a focused stage view and an all-stages overview; a tour
    // step that only knows about one of them breaks in the other.
    for (const file of ["components/board/board-view.tsx", "components/board/board-overview.tsx"]) {
      expect(readFileSync(resolve(file), "utf8")).toContain('data-tour="board-stages"');
    }
  });

  it("drops, rather than guesses, when the anchor is conditional", () => {
    // Each of these only renders in some states — an empty catalog, a profile
    // with no story yet, a social page you have not joined.
    const conditional = [
      "board-stages",
      "track-list",
      "project-grid",
      "artist-story",
      "social-composer",
      "social-people",
      "scenes-browse",
      "scene-open",
      "session-create",
      "session-room",
      "stats-modules",
      "stats-platforms",
    ];
    const steps = tour.split(/\{ selector: /).slice(1);
    for (const name of conditional) {
      const step = steps.find((entry) => entry.startsWith(`anchor("${name}")`));
      expect(step, `no step points at ${name}`).toBeTruthy();
      expect(step, `${name} is conditional, so its step must be droppable`).toContain(
        "needsTarget: true"
      );
    }
  });

  it("opens every page on its own header", () => {
    expect(readFileSync(resolve("components/ui/page-header.tsx"), "utf8")).toContain(
      'data-tour="page-header"'
    );
    // Stats and the artist profile build their own hero instead.
    for (const page of ["app/(app)/stats/page.tsx", "app/(app)/artist/page.tsx"]) {
      expect(readFileSync(resolve(page), "utf8")).toContain('data-tour="page-header"');
    }
  });
});
