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
  /** Near monochrome — silver interactive, bone emphasis. */
  { id: "noir", label: "Noir", ice: "#C8CDD6", amber: "#EDE8DF" },
  { id: "glacier", label: "Glacier", ice: "#9ED8FF", amber: "#D8E8F0" },
  { id: "indigo-sand", label: "Indigo Sand", ice: "#8494FF", amber: "#E8C9A0" },
  { id: "coral-dusk", label: "Coral Dusk", ice: "#FF8FA3", amber: "#FFC07A" },
  { id: "ember", label: "Ember", ice: "#FFAA78", amber: "#FFD08A" },
  { id: "plum-gold", label: "Plum & Gold", ice: "#C084FC", amber: "#F0C878" },
];

/**
 * Flat banner colors — curated deep washes rather than a free picker, so
 * every one stays legible under TEMPO's text tokens once washed toward --bg-0.
 * Includes a near-black and cool graphite for the Noir / Mono look.
 */
export const BANNER_COLORS = [
  "#1B2A44", // deep blue
  "#2A2340", // violet
  "#1E3535", // teal
  "#3A2430", // rose
  "#3A2E1C", // warm brown
  "#242A33", // slate
  "#121212", // near black
  "#1C1C22", // graphite
  "#1C2438", // midnight
  "#2C1F1A", // rust
  "#1A2E28", // forest
  "#322440", // deep plum
  "#252018", // espresso
  "#3A2030", // wine
] as const;

const DEFAULT_PALETTE = ARTIST_PALETTES[0];

export function getArtistPalette(paletteId: string | null | undefined): ArtistPalette {
  return ARTIST_PALETTES.find((p) => p.id === paletteId) ?? DEFAULT_PALETTE;
}

/** True when the artist has free Cool/Warm overrides. */
export function hasCustomAccent(artist: {
  ice_color?: string | null;
  amber_color?: string | null;
} | null | undefined): boolean {
  return !!(artist?.ice_color || artist?.amber_color);
}

export type AccentOverrides = {
  ice?: string | null;
  amber?: string | null;
};

/**
 * Resolve ice/amber for an artist: free overrides win, otherwise the palette
 * preset. White/gray stay fixed (text tokens).
 */
export function resolveArtistAccent(
  paletteId: string | null | undefined,
  overrides?: AccentOverrides | null
): { ice: string; amber: string; fromCustom: boolean } {
  const base = getArtistPalette(paletteId);
  const ice = overrides?.ice || base.ice;
  const amber = overrides?.amber || base.amber;
  return {
    ice,
    amber,
    fromCustom: !!(overrides?.ice || overrides?.amber),
  };
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
export function artistThemeCssVars(
  paletteId: string | null | undefined,
  overrides?: AccentOverrides | null
): Record<string, string> {
  const { ice, amber } = resolveArtistAccent(paletteId, overrides);
  return {
    "--ice": ice,
    "--amber": amber,
    "--primary": hexToHslTriple(ice),
    "--ring": hexToHslTriple(ice),
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

export function resolveArtistHues(
  paletteId: string | null | undefined,
  overrides?: AccentOverrides | null
): ResolvedArtistHues {
  const { ice, amber } = resolveArtistAccent(paletteId, overrides);
  return { ice, white: FIXED_WHITE, amber, gray: FIXED_GRAY };
}

/** Clamp/normalize a browser color input to #rrggbb lowercase. */
export function normalizeHexColor(value: string, fallback: string): string {
  const raw = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const h = raw.slice(1);
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase();
  }
  return fallback;
}
