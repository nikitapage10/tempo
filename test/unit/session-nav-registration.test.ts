import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isPathAllowedForMode } from "@/lib/workspace-mode";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("Sessions nav registration", () => {
  it("puts Sessions in every main rail between Tasks and Artist or Profile", () => {
    const shell = read("components/app-shell.tsx");
    expect(shell).toContain('{ href: "/sessions", label: "Sessions", icon: Radio }');
    expect(shell).toContain(
      '"/sessions": "Rooms where you and your people plan, talk, and work on a song together."'
    );
    expect(shell).toContain("Plan hangs, deadlines, milestones, and release dates.");
    expect(shell).toContain("Sessions is roster-based like Scenes, not an AreaKey");
    expect(shell).not.toContain('"/sessions": "catalog"');
  });

  it("allows Sessions in work and entered modes without an AreaKey grant", () => {
    expect(isPathAllowedForMode("/sessions", "work", {})).toBe(true);
    expect(isPathAllowedForMode("/sessions/abc", "entered", {})).toBe(true);
    const mode = read("lib/workspace-mode.ts");
    expect(mode).toContain('"/sessions"');
    expect(mode).not.toMatch(/prefix:\s*"\/sessions"/);
  });

  it("indexes Sessions in search", () => {
    const search = read("lib/search/match.ts");
    expect(search).toContain('id: "page-sessions"');
    expect(search).toContain('"hang"');
    expect(search).toContain('"studio"');
  });
});
