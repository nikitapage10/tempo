import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { clampContentZoom } from "@/lib/desktop/content-zoom";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("clampContentZoom", () => {
  it("steps to tenths and clamps", () => {
    expect(clampContentZoom(1.04)).toBe(1);
    expect(clampContentZoom(1.06)).toBe(1.1);
    expect(clampContentZoom(0.2)).toBe(0.5);
    expect(clampContentZoom(3)).toBe(2);
    expect(clampContentZoom(Number.NaN)).toBe(1);
  });
});

describe("desktop content zoom wiring", () => {
  const main = read("electron/main.js");
  const preload = read("electron/preload.js");
  const bridge = read("lib/desktop/bridge.ts");
  const shell = read("components/app-shell.tsx");
  const zoom = read("components/desktop/zoom-control.tsx");

  it("keeps Chromium page zoom pinned and nudges the renderer", () => {
    expect(main).toContain("ensureNativeZoomOne");
    expect(main).toContain('send("zoom:nudge"');
    expect(main).not.toMatch(/function adjustZoom/);
    expect(preload).toContain("onNudge");
    expect(preload).toContain("resetNative");
    expect(bridge).toContain("onDesktopZoomNudge");
    expect(bridge).toContain("resetNativePageZoom");
  });

  it("applies zoom to main and keeps a compact rail below xl", () => {
    expect(shell).toContain("useContentZoom");
    expect(shell).toContain("w-[68px]");
    expect(shell).toContain("xl:w-[220px]");
    expect(zoom).toContain("md:left-[84px]");
    expect(zoom).toContain("xl:left-[236px]");
  });
});
