import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("login Tempo Theme bed", () => {
  const bed = read("components/auth/auth-ambient-bed.tsx");
  const main = read("electron/main.js");
  const preload = read("components/intro-preload.tsx");
  const vercel = read("vercel.json");

  it("auto-starts on desktop once media can play, and only locks after play succeeds", () => {
    expect(bed).toContain("isDesktopApp()");
    expect(bed).toContain("canplay");
    expect(bed).toContain("HAVE_CURRENT_DATA");
    expect(bed).toContain("onPlaying");
    expect(bed).toContain("startedRef.current = true");
    expect(bed).toContain("startedRef.current = false");
    // Must not lock started before play resolves.
    const tryStart = bed.slice(bed.indexOf("const tryStart ="), bed.indexOf("const onGesture"));
    expect(tryStart).not.toContain("startedRef.current = true");
  });

  it("retries after logout/reopen instead of relying on a one-shot canplay", () => {
    expect(bed).toContain("setInterval");
    expect(bed).toContain("visibilitychange");
    expect(bed).toContain("tempo-theme-ready");
  });

  it("relies on Electron allowing autoplay without a gesture", () => {
    expect(main).toContain('autoplay-policy", "no-user-gesture-required"');
  });

  it("lets the theme bed warm before competing intro video preload", () => {
    expect(preload).toContain("tempo-theme-ready");
    expect(preload).toContain("2500");
  });

  it("caches the theme mp3 so return visits do not re-download 2.7MB", () => {
    expect(vercel).toContain("onboarding/origin");
    expect(vercel).toContain("max-age=31536000");
  });
});
