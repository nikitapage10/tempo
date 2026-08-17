import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CONTENT_ZOOM_DEFAULT_GEN,
  CONTENT_ZOOM_DEFAULT_GEN_KEY,
  CONTENT_ZOOM_STORAGE_KEY,
  clampContentZoom,
  nudgeContentZoom,
  railLayoutWidthPx,
  railTypeZoom,
  readContentZoom,
  suggestedContentZoom,
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

describe("suggestedContentZoom", () => {
  it("keeps 100% when the OS already scales CSS pixels", () => {
    expect(
      suggestedContentZoom({
        devicePixelRatio: 2,
        screenWidth: 1728,
        screenHeight: 1117,
      })
    ).toBe(1);
    expect(
      suggestedContentZoom({
        devicePixelRatio: 1.5,
        screenWidth: 2560,
        screenHeight: 1440,
      })
    ).toBe(1);
  });

  it("opens larger on 1x high-resolution displays", () => {
    expect(
      suggestedContentZoom({
        devicePixelRatio: 1,
        screenWidth: 3440,
        screenHeight: 1440,
      })
    ).toBe(1.3);
    expect(
      suggestedContentZoom({
        devicePixelRatio: 1,
        screenWidth: 2560,
        screenHeight: 1440,
      })
    ).toBe(1.3);
    expect(
      suggestedContentZoom({
        devicePixelRatio: 1,
        screenWidth: 1920,
        screenHeight: 1080,
      })
    ).toBe(1.2);
  });

  it("adds only a modest bump at 125% Windows scaling", () => {
    expect(
      suggestedContentZoom({
        devicePixelRatio: 1.25,
        screenWidth: 2752,
        screenHeight: 1152,
      })
    ).toBe(1.1);
  });

  it("leaves small 1x screens at 100%", () => {
    expect(
      suggestedContentZoom({
        devicePixelRatio: 1,
        screenWidth: 1366,
        screenHeight: 768,
      })
    ).toBe(1);
  });
});

describe("readContentZoom default migration", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function stubDisplay(opts: {
    zoom?: string | null;
    gen?: string | null;
    width: number;
    height: number;
    dpr: number;
  }) {
    const store = new Map<string, string>();
    if (opts.zoom != null) store.set(CONTENT_ZOOM_STORAGE_KEY, opts.zoom);
    if (opts.gen != null) store.set(CONTENT_ZOOM_DEFAULT_GEN_KEY, opts.gen);
    const localStorage = {
      getItem: (key: string) => store.get(String(key)) ?? null,
      setItem: (key: string, value: string) => {
        store.set(String(key), String(value));
      },
      removeItem: (key: string) => {
        store.delete(String(key));
      },
    };
    vi.stubGlobal("window", {
      localStorage,
      devicePixelRatio: opts.dpr,
      screen: { width: opts.width, height: opts.height },
      dispatchEvent: () => true,
    });
    vi.stubGlobal("localStorage", localStorage);
    return store;
  }

  it("migrates an old 100% default on a 3440×1440 Windows screen", () => {
    const store = stubDisplay({
      zoom: "1",
      width: 3440,
      height: 1440,
      dpr: 1,
    });
    expect(readContentZoom()).toBe(1.3);
    expect(store.get(CONTENT_ZOOM_STORAGE_KEY)).toBe("1.3");
    expect(store.get(CONTENT_ZOOM_DEFAULT_GEN_KEY)).toBe(
      String(CONTENT_ZOOM_DEFAULT_GEN)
    );
  });

  it("keeps an explicit 100% after the new default generation", () => {
    stubDisplay({
      zoom: "1",
      gen: "2",
      width: 3440,
      height: 1440,
      dpr: 1,
    });
    expect(readContentZoom()).toBe(1);
  });

  it("keeps a customized zoom", () => {
    stubDisplay({
      zoom: "1.1",
      width: 3440,
      height: 1440,
      dpr: 1,
    });
    expect(readContentZoom()).toBe(1.1);
  });

  it("resets to the display default rather than 100%", () => {
    stubDisplay({
      zoom: "1.6",
      gen: "2",
      width: 3440,
      height: 1440,
      dpr: 1,
    });
    expect(nudgeContentZoom(0)).toBe(1.3);
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
    expect(zoom).toContain("Reset zoom to default");
    expect(zoom).not.toContain("Reset zoom to 100%");
  });

  it("delays corner zoom so it does not arrive with Tune in", () => {
    expect(zoom).toContain("useOnboardingChromeReveal");
    expect(zoom).toContain("ONBOARDING_CHROME_FADE_IN_MS");
    expect(zoom).toContain("corner && visible");
  });

  it("offers bottom-left zoom during both onboarding films", () => {
    const origin = read("components/origin/origin-experience.tsx");
    const passage = read("components/passage/passage-experience.tsx");
    expect(origin).toContain("useContentZoom");
    expect(origin).toContain('placement="corner"');
    expect(origin).toContain("ZoomControl");
    expect(passage).toContain("useContentZoom");
    expect(passage).toContain('placement="corner"');
    expect(passage).toContain("ZoomControl");
    expect(passage).toContain('["--origin-zoom"]: String(contentZoom)');
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
