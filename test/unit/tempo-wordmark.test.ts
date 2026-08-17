import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("TEMPO supplied wordmark", () => {
  const wordmark = read("components/wordmark.tsx");

  it("uses the supplied raster for every full brand lockup", () => {
    expect(existsSync(resolve("public/tempo-logo.png"))).toBe(true);
    expect(wordmark).toContain('src="/tempo-logo.png"');
    expect(wordmark).not.toContain(">TEMPO<");
  });

  it("keeps a compact mark for controls where the wide logo cannot fit", () => {
    expect(wordmark).toContain("markOnly");
    expect(wordmark).toContain("BARS.map");
  });

  it("uses the real mark in the main rail and public entry points", () => {
    expect(read("components/app-shell.tsx")).toContain(
      '<Wordmark size={26} className="hidden xl:inline-flex" />'
    );
    for (const path of [
      "app/login/page.tsx",
      "app/invite/[token]/page.tsx",
      "app/team-invite/[token]/page.tsx",
      "app/p/[handle]/public-profile-view.tsx",
      "app/review/page.tsx",
    ]) {
      expect(read(path)).toContain("<Wordmark");
    }
  });
});
