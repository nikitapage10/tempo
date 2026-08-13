import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("public desktop channel tracking", () => {
  it("resolves Windows and Mac downloads from GitHub latest", () => {
    expect(existsSync(resolve("lib/desktop/public-channel.ts"))).toBe(true);
    expect(read("app/api/desktop/windows/route.ts")).toContain("fetchLatestDesktopAssets");
    expect(read("app/api/desktop/mac/route.ts")).toContain("fetchLatestDesktopAssets");
    expect(existsSync(resolve("app/api/desktop/latest/route.ts"))).toBe(true);
    expect(read("app/download/page.tsx")).toContain("/api/desktop/latest");
  });
});
