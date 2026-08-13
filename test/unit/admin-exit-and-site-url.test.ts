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

  it("washes Admin with the same persistent video backdrop as the studio", () => {
    expect(shell).toContain("AppVideoBackdrop");
    expect(shell).toContain("md:left-[15rem]");
  });

  it("exposes a System health destination from the desktop rail", () => {
    expect(shell).toContain('href: "/admin/system"');
    expect(shell).toContain("HeartPulse");
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
