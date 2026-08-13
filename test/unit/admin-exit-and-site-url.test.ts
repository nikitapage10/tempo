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
    expect(shell).toContain("absolute inset-0");
    expect(shell).not.toContain("md:left-[15rem]");
  });

  it("keeps Back to TEMPO on the ops rail while the pages scroll", () => {
    expect(shell).toContain("md:h-screen md:max-h-screen md:overflow-hidden");
    expect(shell).toContain("h-screen w-[15rem]");
    expect(shell).toContain("shrink-0 px-3 pb-2");
  });

  it("zooms the inner scroller, not the video wash", () => {
    expect(shell).toContain("useContentZoom");
    expect(shell).toContain("overflow-y-auto");
    expect(shell).toContain("{ zoom: contentZoom }");
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
