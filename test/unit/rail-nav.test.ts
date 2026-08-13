import { describe, expect, it } from "vitest";
import {
  flattenRailItems,
  isPointerAimingAtFlyout,
  isRailHrefActive,
  isRailItemActive,
} from "@/components/rail-nav-item";
import type { LucideIcon } from "lucide-react";

const Icon = (() => null) as unknown as LucideIcon;

describe("rail flyouts", () => {
  it("treats a child route as an active parent", () => {
    const artist = {
      href: "/artist",
      label: "Artist",
      icon: Icon,
      children: [
        { href: "/team", label: "Team", icon: Icon },
        { href: "/stats", label: "Stats", icon: Icon },
      ],
    };
    expect(isRailItemActive("/team", artist)).toBe(true);
    expect(isRailItemActive("/stats", artist)).toBe(true);
    expect(isRailItemActive("/artist", artist)).toBe(true);
    expect(isRailItemActive("/board", artist)).toBe(false);
  });

  it("flattens unique children for the phone More sheet", () => {
    const social = {
      href: "/social",
      label: "Social",
      icon: Icon,
      children: [
        { href: "/social", label: "Network", icon: Icon },
        { href: "/scenes", label: "Scenes", icon: Icon },
      ],
    };
    const flat = flattenRailItems([social]);
    expect(flat.map((item) => `${item.label}:${item.href}`)).toEqual([
      "Social:/social",
      "Scenes:/scenes",
    ]);
  });

  it("matches nested paths without treating Today as everything", () => {
    expect(isRailHrefActive("/", "/")).toBe(true);
    expect(isRailHrefActive("/artist", "/")).toBe(false);
    expect(isRailHrefActive("/scenes/demo", "/scenes")).toBe(true);
  });

  it("keeps the open menu while the pointer aims at it, and switches instantly down the rail", () => {
    const flyout = { left: 200, top: 80, right: 360, bottom: 260 };
    expect(
      isPointerAimingAtFlyout({ x: 80, y: 100 }, { x: 120, y: 170 }, flyout)
    ).toBe(true);
    expect(
      isPointerAimingAtFlyout({ x: 80, y: 100 }, { x: 95, y: 190 }, flyout)
    ).toBe(true);
    expect(
      isPointerAimingAtFlyout({ x: 80, y: 100 }, { x: 80, y: 210 }, flyout)
    ).toBe(false);
    expect(
      isPointerAimingAtFlyout({ x: 80, y: 210 }, { x: 80, y: 210 }, flyout)
    ).toBe(false);
    expect(
      isPointerAimingAtFlyout({ x: 80, y: 100 }, { x: 70, y: 140 }, flyout)
    ).toBe(false);
    expect(
      isPointerAimingAtFlyout({ x: 80, y: 100 }, { x: 240, y: 140 }, flyout)
    ).toBe(true);
  });
});
