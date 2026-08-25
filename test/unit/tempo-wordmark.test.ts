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

  it("pairs the light-bar mark with the supplied TEMPO type and a divider in the labeled rail", () => {
    expect(existsSync(resolve("public/tempo-wordmark.png"))).toBe(true);
    expect(wordmark).toContain("withMark");
    expect(wordmark).toContain('src="/tempo-wordmark.png"');
    expect(wordmark).not.toContain("TypeWordmark");
    expect(wordmark).toContain("w-px");
    const shell = read("components/app-shell.tsx");
    expect(shell).toContain("withMark");
    expect(shell).toContain("max-w-full min-[960px]:inline-flex");
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

describe("workspace header alignment", () => {
  it("keeps Search on the same working column as the page panels", () => {
    const shell = read("components/app-shell.tsx");
    expect(shell).toContain("tempo-page-col relative z-10 flex items-center justify-end");
    expect(shell).toContain("tempo-page-col relative z-[1] px-4 md:px-8");
  });
});
