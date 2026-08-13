import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  clampContentZoom,
  railLayoutWidthPx,
  railTypeZoom,
} from "@/lib/desktop/content-zoom";

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

describe("railTypeZoom", () => {
  it("never scales the compact rail", () => {
    expect(railTypeZoom(1.4, false)).toBe(1);
    expect(railLayoutWidthPx(1.4, false)).toBe(68);
  });

  it("scales labeled rail type up to the ceiling", () => {
    expect(railTypeZoom(1.2, true)).toBe(1.2);
    expect(railTypeZoom(1.8, true)).toBe(1.35);
    expect(railLayoutWidthPx(1.4, true)).toBe(Math.round(220 * 1.35));
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

  it("zooms an inner scroller and grows labeled rail only when there is room", () => {
    expect(shell).toContain("useContentZoom");
    expect(shell).toContain("railLayoutWidthPx");
    expect(shell).toContain("overflow-hidden");
    expect(shell).toContain("AppVideoBackdrop");
    expect(shell).toContain("absolute inset-0");
    expect(zoom).toContain("railLayoutWidthPx");
    expect(zoom).toContain("--tempo-zoom-left");
    expect(zoom).toContain('placement?: "rail" | "corner" | "admin"');
  });

  it("offers bottom-left zoom during Origin onboarding", () => {
    const origin = read("components/origin/origin-experience.tsx");
    expect(origin).toContain("useContentZoom");
    expect(origin).toContain('placement="corner"');
    expect(origin).toContain("ZoomControl");
  });

  it("offers zoom on Admin past the ops rail, without scaling the wash", () => {
    const admin = read("components/admin/admin-shell.tsx");
    expect(admin).toContain("useContentZoom");
    expect(admin).toContain('placement="admin"');
    expect(admin).toContain("ZoomControl");
    expect(admin).toContain("AppVideoBackdrop");
    expect(admin).toContain("absolute inset-0");
    expect(admin).toContain("overflow-hidden");
  });
});
