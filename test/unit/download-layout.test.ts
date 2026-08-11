import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const downloadPage = fs.readFileSync(
  path.join(process.cwd(), "app/(app)/download/page.tsx"),
  "utf8"
);

describe("Download page layout", () => {
  it("uses the shared full-width app-shell gutters", () => {
    expect(downloadPage).toContain('<div className="w-full space-y-6">');
    expect(downloadPage).not.toContain("mx-auto max-w-3xl");
  });
});
