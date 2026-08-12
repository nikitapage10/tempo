import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("admin shell exit", () => {
  const shell = read("components/admin/admin-shell.tsx");

  it("offers Back to TEMPO into the regular studio", () => {
    expect(shell).toContain('href="/"');
    expect(shell).toContain("Back to TEMPO");
    expect(shell).toContain("ArrowLeft");
  });
});

describe("canonical production URL", () => {
  it("points shipped absolute links at mytempo.dev", () => {
    expect(read("lib/site.ts")).toContain('PRODUCTION_SITE_URL = "https://mytempo.dev"');
    expect(read("app/manifest.ts")).toContain("https://mytempo.dev/");
    expect(read("electron/main.js")).toContain('"https://mytempo.dev"');
    expect(read("electron/main.js")).toContain("tempo-ten-sigma.vercel.app");
  });
});
