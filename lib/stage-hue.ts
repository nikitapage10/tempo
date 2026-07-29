/**
 * Stage → hue helpers for Lightfield window tints (cold → hot).
 * Interpolates along ice → white → amber by normalized stage progress 0…1.
 */

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function mix(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

const ICE = "#7FB4FF";
const WHITE = "#F2F0EB";
const AMBER = "#FFB56B";

/**
 * Progress 0 (Idea) → 1 (Released): ice → white → amber.
 *
 * `hues` lets the active artist's palette drive the ramp's endpoints; the
 * shape of the ramp (cold → hot across the pipeline) is unchanged.
 */
export function stageHueAt(
  progress: number,
  hues: { ice: string; white: string; amber: string } = {
    ice: ICE,
    white: WHITE,
    amber: AMBER,
  }
): string {
  const t = Math.max(0, Math.min(1, progress));
  const ice = hexToRgb(hues.ice);
  const white = hexToRgb(hues.white);
  const amber = hexToRgb(hues.amber);
  if (t < 0.5) {
    const [r, g, b] = mix(ice, white, t * 2);
    return rgbToHex(r, g, b);
  }
  const [r, g, b] = mix(white, amber, (t - 0.5) * 2);
  return rgbToHex(r, g, b);
}

export function stageProgressFromSort(
  sort: number,
  stages: { sort: number }[]
): number {
  if (stages.length <= 1) return 0.5;
  const sorts = stages.map((s) => s.sort);
  const min = Math.min(...sorts);
  const max = Math.max(...sorts);
  if (max === min) return 0.5;
  return (sort - min) / (max - min);
}
