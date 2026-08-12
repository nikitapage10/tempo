import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("import follow-up pacing", () => {
  const ask = read("lib/ai/ask-followups.ts");
  const canvas = read("components/import/intake-canvas.tsx");

  it("tells the model to stop once the workspace basics exist", () => {
    expect(ask).toContain("Stop early");
    expect(ask).toContain("return ZERO questions");
    expect(ask).toContain("enoughToProceed true");
  });

  it("caps questions and surfaces a That’s everything cue", () => {
    expect(canvas).toContain("MAX_FOLLOWUP_QUESTIONS");
    expect(canvas).toContain("BASICS_DONE_CUE");
    expect(canvas).toContain("That’s everything");
    expect(canvas).toContain("basicsReady");
    expect(canvas).toContain("doneCue");
  });
});
