import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const downloadPage = fs.readFileSync(
  path.join(process.cwd(), "app/download/page.tsx"),
  "utf8"
);

describe("Download page layout", () => {
  it("is a public Spectra/glass landing outside the signed-in app shell", () => {
    expect(downloadPage).toContain("glass-hero");
    expect(downloadPage).toContain("LfWindow");
    expect(downloadPage).toContain("field");
    expect(downloadPage).toContain("TEMPO on your computer");
    expect(downloadPage).toContain("Use the web app");
    expect(downloadPage).toContain("min-w-0");
    expect(downloadPage).toContain("whitespace-normal");
    expect(downloadPage).toContain('href="/login"');
    expect(fs.existsSync(path.join(process.cwd(), "app/(app)/download/page.tsx"))).toBe(
      false
    );
  });
});
