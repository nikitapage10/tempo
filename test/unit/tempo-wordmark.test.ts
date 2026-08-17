import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("TEMPO supplied wordmark", () => {
  const wordmark = read("components/wordmark.tsx");

  it("uses the supplied raster for standalone brand lockups", () => {
    expect(existsSync(resolve("public/tempo-logo.png"))).toBe(true);
    expect(wordmark).toContain('src="/tempo-logo.png"');
  });

  it("keeps a compact mark for controls where the wide logo cannot fit", () => {
    expect(wordmark).toContain("markOnly");
    expect(wordmark).toContain("BARS.map");
  });

  it("pairs the light-bar mark with typeset TEMPO and a divider in the labeled rail", () => {
    expect(wordmark).toContain("withMark");
    expect(wordmark).toContain("TypeWordmark");
    expect(wordmark).toMatch(/>\s*TEMPO\s*</);
    expect(wordmark).toContain("w-px");
    expect(read("components/app-shell.tsx")).toContain(
      '<Wordmark size={26} withMark className="hidden xl:inline-flex" />'
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
