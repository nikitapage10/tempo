import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("Social discovery", () => {
  it("builds a broad recently-active pool outside the CRM and follow graph", () => {
    const peopleApi = read("lib/api/people.ts");
    expect(peopleApi).toContain("fetchRecentlyActiveProfiles");
    expect(peopleApi).toContain('.from("posts")');
    expect(peopleApi).toContain('.from("artist_profiles")');
    expect(peopleApi).toContain('.in("visibility", ["members", "public"])');
    expect(peopleApi).toContain("LEGACY_SYNTHETIC_HANDLES.has");
    expect(peopleApi).not.toContain("fetchRecentlyActiveProfiles(opts");
  });

  it("adds activity pins in Discover without resetting the globe", () => {
    const social = read("app/(app)/social/social-view.tsx");
    const globe = read("components/social/connection-globe.tsx");
    expect(social).toContain(
      'tab === "discover" ? discoverGlobePeople : globePeople'
    );
    expect(social).toContain('max={tab === "discover" ? 120 : 80}');
    expect(social).not.toContain("Recently active around TEMPO");
    expect(social).toContain("Followed and new-to-you artists");
    expect(social).toContain("Recently interacted with");
    expect(globe).toContain("const phiRef = React.useRef(0)");
    expect(globe).toContain("let phi = phiRef.current");
    expect(globe).toContain("phiRef.current = phi");
    expect(globe).toContain("globeRef.current?.update");
    expect(globe).toContain("[size, markerRgb]");
    expect(globe).not.toContain("[size, allMarkers, markerRgb");
  });

  it("keeps the WebGL limb outside the fixed globe crop", () => {
    const globe = read("components/social/connection-globe.tsx");
    expect(globe).toContain('width: "127%"');
    expect(globe).toContain('height: "127%"');
    expect(globe).toContain('mixBlendMode: "screen"');
    expect(globe).toContain("dark antialiased limb");
  });

  it("crops the desktop Social globe to about two-thirds of the sphere", () => {
    const globe = read("components/social/connection-globe.tsx");
    expect(globe).toContain("VISIBLE_DESKTOP = 0.66");
    expect(globe).toContain("isDesktopApp()");
    expect(globe).toContain("GLOBE_LIFT_DESKTOP_PX");
  });
});
