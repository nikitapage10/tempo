import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("Mac and Windows desktop parity", () => {
  it("requires both platform jobs in Desktop Release", () => {
    const workflow = read(".github/workflows/desktop-release.yml");
    expect(workflow).toContain("windows-release:");
    expect(workflow).toContain("mac-release:");
    expect(workflow).toContain("TEMPO-Setup.exe");
    expect(workflow).toContain("TEMPO-Mac.dmg");
    expect(workflow).toContain("latest-mac.yml");
  });

  it("documents Mac ↔ Windows shell parity as required", () => {
    const policy = read("docs/WEB-DESKTOP-RELEASE-POLICY.md");
    const rules = read(".cursorrules");
    expect(policy).toContain("Mac ↔ Windows shell parity");
    expect(policy).toContain("TEMPO-Mac.dmg");
    expect(rules).toContain("Mac ↔ Windows desktop parity is required");
  });
});
