import { describe, expect, it } from "vitest";
import {
  clampMediaVolume,
  fadeProgress,
} from "@/lib/audio/tempo-theme-bed";

describe("Tempo Theme volume fades", () => {
  it("keeps media volume inside the browser's legal [0, 1] range", () => {
    expect(clampMediaVolume(-0.00005)).toBe(0);
    expect(clampMediaVolume(0)).toBe(0);
    expect(clampMediaVolume(0.19)).toBe(0.19);
    expect(clampMediaVolume(1)).toBe(1);
    expect(clampMediaVolume(1.2)).toBe(1);
    expect(clampMediaVolume(Number.NaN)).toBe(0);
  });

  it("treats a first animation frame that lands before start as progress 0", () => {
    // requestAnimationFrame can hand back a timestamp slightly earlier than a
    // performance.now() captured just before scheduling — without a floor that
    // becomes a negative volume write, which throws and kills the fade.
    expect(fadeProgress(1000, 1000.05, 1400)).toBe(0);
    expect(fadeProgress(1000, 1000, 1400)).toBe(0);
    expect(fadeProgress(1700, 1000, 1400)).toBeCloseTo(0.5, 5);
    expect(fadeProgress(3000, 1000, 1400)).toBe(1);
    expect(fadeProgress(1000, 1000, 0)).toBe(1);
  });
});
