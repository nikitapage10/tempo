import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("achievement list", () => {
  it("shows every unlocked achievement, not a first-eight slice", () => {
    const list = read("components/gamification/achievement-list.tsx");
    expect(list).not.toContain("slice(0, 8)");
    expect(list).toContain("earned.map(");
    expect(list).toContain("max-h-[28rem]");
  });

  it("lights earned tiles and dims locked ones, including the shard", () => {
    const list = read("components/gamification/achievement-list.tsx");
    expect(list).toContain("achievement-tile-earned");
    expect(list).toContain("achievement-tile-locked");
    const shard = read("components/gamification/prism-shard.tsx");
    expect(shard).toContain("const dim = !earned");
    expect(shard).not.toContain('grade === "umbra" && !earned');
  });
});
