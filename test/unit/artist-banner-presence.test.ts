import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("artist banner presence", () => {
  const banner = read("components/artists/artist-banner.tsx");
  const today = read("app/(app)/page.tsx");
  const globals = read("app/globals.css");

  it("keeps the photo strong enough to read on glass heroes", () => {
    expect(banner).toContain("opacity-[0.72]");
    expect(banner).not.toContain("opacity-[0.22]");
  });

  it("draws the text scrim above the banner photo on Today", () => {
    const photo = today.indexOf("<ArtistBanner");
    const scrim = today.indexOf('className="scrim-reveal absolute inset-0"');
    expect(photo).toBeGreaterThan(-1);
    expect(scrim).toBeGreaterThan(photo);
  });

  it("uses a lighter reveal scrim so media is not crushed", () => {
    expect(globals).toContain("rgb(10 10 12 / 0.48)");
    expect(globals).not.toMatch(/\.scrim-reveal \{\s*background: linear-gradient\(\s*100deg,\s*rgb\(10 10 12 \/ 0\.72\)/);
  });
});
