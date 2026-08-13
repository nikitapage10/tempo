import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("auth middleware static allowlist", () => {
  it("lets Origin soundtrack and intro media through before sign-in", () => {
    const middleware = readFileSync(resolve("middleware.ts"), "utf8");
    expect(middleware).toContain("onboarding/");
    expect(middleware).toContain("intro/");
    expect(middleware).toMatch(/mp3/);
    expect(middleware).toContain("downloads/");
  });
});
