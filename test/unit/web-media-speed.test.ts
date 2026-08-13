import { describe, expect, it } from "vitest";
import { proxyRouteForStoragePath } from "@/lib/media/resolve-image-url";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("web media load speed", () => {
  it("routes scene and social paths straight to proxy (skip doomed client sign)", () => {
    expect(proxyRouteForStoragePath("scenes/abc/banner.png")).toBe(
      "/api/scenes/media/url"
    );
    expect(proxyRouteForStoragePath("artists/abc/logo.png")).toBe(
      "/api/social/media/url"
    );
    expect(proxyRouteForStoragePath("profiles/abc/avatar.png")).toBe(
      "/api/social/media/url"
    );
    expect(
      proxyRouteForStoragePath("tracks/11111111-1111-4111-8111-111111111111/assets/a/cover.jpg")
    ).toBeNull();
  });

  it("shows Spectra while covers sign and warms the browser cache after sign-in", () => {
    const spectra = read("components/spectra/spectra-cover-art.tsx");
    const shell = read("components/app-shell.tsx");
    const warm = read("lib/media/browser-warm.ts");
    const storage = read("lib/storage.ts");
    expect(spectra).toContain("fallback=");
    expect(spectra).toContain("SpectraPlaceholder");
    expect(shell).toContain("useBrowserMediaWarm()");
    expect(warm).toContain("warmBrowserMediaCache");
    expect(warm).toContain("warmSignedUrls");
    expect(storage).toContain("createSignedUrls");
  });
});
