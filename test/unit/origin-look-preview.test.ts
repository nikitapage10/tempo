import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("Origin Look step preview", () => {
  const look = read("components/origin/origin-look-step.tsx");

  it("gives the banner strip more height and contains the logo", () => {
    expect(look).toContain("aspect-[2/1]");
    expect(look).toContain("md:min-h-[15.5rem]");
    expect(look).toContain("object-contain object-right");
    expect(look).toContain("bottom-5 right-4 top-5");
  });

  it("shows logo and profile thumbnails on the left of the upload rows", () => {
    expect(look).toContain("preview=");
    expect(look).toContain("ArtistMark");
    expect(look).toContain('label="Profile"');
    expect(look).toContain("preview?: React.ReactNode");
  });
});
