import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const settings = fs.readFileSync(
  path.join(process.cwd(), "app/(app)/settings/page.tsx"),
  "utf8"
);

describe("Settings page layout", () => {
  it("uses the shared full-width app-shell gutters", () => {
    expect(settings).toContain('<div className="w-full">');
    expect(settings).toContain('className="panel h-64 w-full animate-pulse"');
    expect(settings).not.toContain("mx-auto max-w-5xl");
  });
});
