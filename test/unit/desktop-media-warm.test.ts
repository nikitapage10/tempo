import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("desktop media vault warm", () => {
  it("collects catalog imagery and schedules a quiet vault pass", () => {
    const warm = read("lib/desktop/media-warm.ts");
    expect(warm).toContain("collectDesktopMediaWarmPaths");
    expect(warm).toContain("warmDesktopVaultMedia");
    expect(warm).toContain("scheduleDesktopMediaWarm");
    expect(warm).toContain("fetchMyScenes");
    expect(warm).toContain("fetchTrackGroups");
    expect(warm).toContain("artwork_url");
    expect(warm).toContain("cover_url");
    expect(warm).toContain("mirrorSignedUrlToVault");
  });

  it("runs from the signed-in app shell on desktop only", () => {
    const hook = read("hooks/use-desktop-media-warm.ts");
    const shell = read("components/app-shell.tsx");
    expect(hook).toContain("isDesktopApp()");
    expect(hook).toContain("scheduleDesktopMediaWarm");
    expect(shell).toContain("useDesktopMediaWarm()");
  });

  it("prefers the local vault when resolving images on desktop", () => {
    const resolve = read("lib/media/resolve-image-url.ts");
    const image = read("components/ui/signed-image.tsx");
    expect(resolve).toContain("vaultResolveUrl");
    expect(resolve).toContain("isDesktopApp()");
    expect(image).toContain("resolveStorageImageUrl");
    expect(image).toContain("isDesktopApp()");
  });
});
