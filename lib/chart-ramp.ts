/**
 * OKLCH lightness stepping for chart marks.
 *
 * TEMPO's accent tokens are tuned for text and 1px edges, which puts them
 * above the lightness band that large chart fills need on a dark surface
 * (raw ice sits at L 0.76, amber at L 0.83; the dark-mode band is 0.48–0.67).
 * Rather than invent chart-only hues — which would break the promise that an
 * artist's palette follows them everywhere — we hold hue and chroma and move
 * only lightness. Band and contrast are properties of L, so they hold for any
 * artist palette; the hue stays the artist's own.
 *
 * With the default palette these produce exactly the hexes validated against
 * the data-viz checks (ice #578ad2, amber #bc7728, and the two ordinal ramps).
 */

function hexToLinearSrgb(hex: string): [number, number, number] {
  const h = hex.trim().replace(/^#/, "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return [0, 2, 4].map((i) =>
    toLinear(parseInt(full.slice(i, i + 2), 16) / 255)
  ) as [number, number, number];
}

function linearSrgbToHex(rgb: [number, number, number]): string {
  const toSrgb = (c: number) => {
    const clamped = Math.max(0, Math.min(1, c));
    return clamped <= 0.0031308
      ? 12.92 * clamped
      : 1.055 * clamped ** (1 / 2.4) - 0.055;
  };
  return (
    "#" +
    rgb
      .map((c) =>
        Math.round(toSrgb(c) * 255)
          .toString(16)
          .padStart(2, "0")
      )
      .join("")
  );
}

function oklabFromLinear([r, g, b]: [number, number, number]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ] as [number, number, number];
}

function linearFromOklab([L, a, b]: [number, number, number]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ] as [number, number, number];
}

/** Hold hue, drop chroma only as far as the sRGB gamut demands. */
export function atLightness(hex: string, targetL: number): string {
  const [, a, b] = oklabFromLinear(hexToLinearSrgb(hex));
  const chroma = Math.hypot(a, b);
  const hue = Math.atan2(b, a);
  for (let c = chroma; c >= 0; c -= 0.002) {
    const rgb = linearFromOklab([targetL, Math.cos(hue) * c, Math.sin(hue) * c]);
    if (rgb.every((v) => v >= -0.001 && v <= 1.001)) return linearSrgbToHex(rgb);
  }
  return linearSrgbToHex(linearFromOklab([targetL, 0, 0]));
}

/** Lightness stops, kept here so every consumer steps identically. */
export const CHART_L = {
  /** Two-series categorical fills, both inside the dark band. */
  series: 0.63,
  /** Magnitude ramp, dim → bright. */
  sequential: [0.44, 0.53, 0.62, 0.71, 0.8],
  /** Momentum heat, active → parked. */
  momentum: [0.78, 0.66, 0.54, 0.42],
} as const;

export type ChartPalette = {
  primary: string;
  secondary: string;
  sequential: string[];
  momentum: string[];
};

export function buildChartPalette(hues: {
  ice: string;
  amber: string;
}): ChartPalette {
  return {
    primary: atLightness(hues.ice, CHART_L.series),
    secondary: atLightness(hues.amber, CHART_L.series),
    sequential: CHART_L.sequential.map((l) => atLightness(hues.ice, l)),
    momentum: CHART_L.momentum.map((l) => atLightness(hues.amber, l)),
  };
}
