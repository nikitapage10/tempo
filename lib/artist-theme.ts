/**
 * Per-artist visual identity — a curated set of palette presets, each
 * re-hueing the two Spectra role colors (ice = interactive, amber =
 * status/emphasis) while keeping every other token — backgrounds, text,
 * --ok/--warn, radii, shadows, the flare-line/spotlight motif shape — fixed.
 *
 * "spectra" is the default and is numerically identical to the hardcoded
 * tokens in app/globals.css, so an artist who never picks a palette sees
 * exactly today's TEMPO. Presets are curated (not a free color picker) so
 * every option keeps the same contrast against --bg-0..3 and stays clear of
 * --ok/--warn (success/error must read the same for every artist).
 */

export type ArtistPalette = {
  id: string;
  label: string;
  /** Interactive role — buttons, links, focus, "cool" end of the ramp. */
  ice: string;
  /** Status/emphasis role — "current" markers, momentum, "warm" end of the ramp. */
  amber: string;
};

export const ARTIST_PALETTES: ArtistPalette[] = [
  { id: "spectra", label: "Spectra (default)", ice: "#7FB4FF", amber: "#FFB56B" },
  { id: "violet-dusk", label: "Violet Dusk", ice: "#9D8CFF", amber: "#FFB56B" },
  { id: "teal-gold", label: "Teal & Gold", ice: "#4FC9C9", amber: "#FFD166" },
  { id: "rose-copper", label: "Rose & Copper", ice: "#FF8FCB", amber: "#FF9D6B" },
  { id: "cobalt-honey", label: "Cobalt & Honey", ice: "#6FA8FF", amber: "#FFCB6B" },
  { id: "mint-flare", label: "Mint Flare", ice: "#6FE0C2", amber: "#FFB56B" },
];

/**
 * Flat banner colours — deliberately a short curated row rather than a free
 * picker, for the same reason palettes are: every one has to sit under
 * TEMPO's text tokens at a legible contrast once it's washed toward --bg-0.
 * These are deep/desaturated on purpose; the gradient does the rest.
 */
export const BANNER_COLORS = [
  "#1B2A44",
  "#2A2340",
  "#1E3535",
  "#3A2430",
  "#3A2E1C",
  "#242A33",
] as const;

const DEFAULT_PALETTE = ARTIST_PALETTES[0];

export function getArtistPalette(paletteId: string | null | undefined): ArtistPalette {
  return ARTIST_PALETTES.find((p) => p.id === paletteId) ?? DEFAULT_PALETTE;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** hex -> "H S% L%" for the shadcn HSL-triple custom properties. */
function hexToHslTriple(hex: string): string {
  const [r8, g8, b8] = hexToRgb(hex);
  const r = r8 / 255;
  const g = g8 / 255;
  const b = b8 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * CSS custom property overrides for a palette, applied to <html> so they
 * reach portaled content (dialogs, dropdowns) as well as the main tree.
 * Values are identical to app/globals.css defaults for "spectra".
 */
export function artistThemeCssVars(paletteId: string | null | undefined): Record<string, string> {
  const palette = getArtistPalette(paletteId);
  return {
    "--ice": palette.ice,
    "--amber": palette.amber,
    "--primary": hexToHslTriple(palette.ice),
    "--ring": hexToHslTriple(palette.ice),
  };
}

/**
 * Resolved hex values for consumers that can't read CSS variables — canvas,
 * wavesurfer, and the placeholder-cover generator. "white"/"gray" stay fixed
 * (they're text tokens, not a role that changes per artist).
 */
export type ResolvedArtistHues = {
  ice: string;
  white: string;
  amber: string;
  gray: string;
};

const FIXED_WHITE = "#F2F0EB";
const FIXED_GRAY = "#8B8B96";

export function resolveArtistHues(paletteId: string | null | undefined): ResolvedArtistHues {
  const palette = getArtistPalette(paletteId);
  return { ice: palette.ice, white: FIXED_WHITE, amber: palette.amber, gray: FIXED_GRAY };
}
