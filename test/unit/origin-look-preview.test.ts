import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("Origin Look step preview", () => {
  const look = read("components/origin/origin-look-step.tsx");
  const preview = look.slice(look.indexOf("function LookPreview"));

  it("cannot be squashed by the scrolling column it sits in", () => {
    // The whole bug: as a flex child the strip is allowed to shrink past its
    // own min-height, and `overflow-hidden` then hid the collapse — so only
    // the banner survived and the profile row was cut off entirely. An
    // aspect-ratio/min-height pair does not prevent that; shrink-0 does.
    expect(preview).toContain("shrink-0 overflow-hidden");
    expect(preview).not.toContain("aspect-[");
  });

  it("composes banner, logo and profile mark in one frame", () => {
    expect(preview).toContain("ArtistBanner");
    expect(preview).toContain("object-contain object-right");
    expect(preview).toContain("ArtistMark");
  });

  it("keeps the logo clear of the profile mark", () => {
    // Logo pinned top-right over the banner, profile overlapping bottom-left.
    expect(preview).toContain("right-4 top-3");
    expect(preview).toContain("-mt-7");
  });

  it("shows logo and profile thumbnails on the left of the upload rows", () => {
    expect(look).toContain("preview=");
    expect(look).toContain('label="Profile"');
    expect(look).toContain("preview?: React.ReactNode");
  });

  it("lets Passage reuse it with its own words", () => {
    expect(look).toContain("kicker");
    expect(look).toContain("heading");
    expect(look).toContain("blurb");
  });
});
