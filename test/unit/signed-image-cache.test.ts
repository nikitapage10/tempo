import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("signed image URL cache", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("remembers proxy-signed URLs so peek hits without resigning", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });

    const { cacheSignedUrl, peekSignedUrl, invalidateSignedUrl } = await import(
      "@/lib/storage"
    );

    const mediaPath =
      "scenes/11111111-1111-4111-8111-111111111111/banner/x/y.jpg";
    expect(peekSignedUrl(mediaPath)).toBeNull();

    cacheSignedUrl(mediaPath, "https://cdn.example/signed?token=abc");
    expect(peekSignedUrl(mediaPath)).toBe(
      "https://cdn.example/signed?token=abc"
    );

    invalidateSignedUrl(mediaPath);
    expect(peekSignedUrl(mediaPath)).toBeNull();
  });

  it("caches scene and social proxy results from SignedImage", () => {
    const source = fs.readFileSync(
      path.resolve("components/ui/signed-image.tsx"),
      "utf8"
    );
    expect(source).toContain("cacheSignedUrl");
    expect(source).toContain("peekSignedUrl(path)");
    expect(source).toContain("proxyInflight");
    expect(source).toContain("/api/scenes/media/url");
    expect(source).toContain("/api/social/media/url");
  });
});
