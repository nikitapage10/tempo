import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

/**
 * Regression: building the demo listed PRESIDENT in the artist switcher, but
 * both opening it and picking it there snapped straight back to the member's
 * own artist. The Origin handoff pointer was written to sessionStorage and
 * never removed, so it re-applied itself on every pass of the reconciling
 * effect and also won the render-time resolution — outranking the click.
 */
describe("switching to the demo artist", () => {
  const provider = read("components/active-artist-provider.tsx");

  it("consumes the Origin handoff pointer instead of re-applying it forever", () => {
    const consumed = provider.match(
      /consumeSessionPointer\(PREFER_ORIGIN_ARTIST_KEY\)/g
    );
    // Once when the Origin handoff itself is applied, and once when opening the
    // demo, which has to supersede an earlier handoff in the same tab.
    expect(consumed?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("consumes every one-navigation pointer exactly where it is applied", () => {
    expect(provider).toContain("consumeSessionPointer(PREFER_DEMO_ARTIST_KEY)");
    expect(provider).toContain('consumeSessionPointer("tempo.preferPersonalHome")');
  });

  it("still treats an explicitly chosen demo as the active workspace", () => {
    expect(provider).toContain("explicitDemoActiveRef.current = true");
    expect(provider).toContain("setActiveArtistId");
  });

  it("opens the demo through a one-navigation handoff, not a stored default", () => {
    const api = read("lib/api/demo.ts");
    expect(api).toContain("PREFER_DEMO_ARTIST_KEY");
    const button = read("components/demo/try-demo-button.tsx");
    expect(button).toContain("focusDemo");
    expect(button).toContain("/demo/open");
  });

  it("refetches spaces for whichever artist is active, so the switch carries", () => {
    expect(read("components/active-space-provider.tsx")).toContain(
      'queryKey: ["spaces", activeArtistId'
    );
  });
});
