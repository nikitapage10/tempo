/**
 * Spectra Title Language — title → vertical light-slit score.
 * Spec: SPECTRA-TITLE-LANGUAGE.md
 *
 * Design-first, not meant to be decoded. Parentheticals / featuring text
 * participate in the motif. Digits act like letters. Short titles repeat;
 * long titles are capped.
 */

export type SpectraHue = "ice" | "white" | "amber" | "gray";
export type SpectraLength = "short" | "medium" | "tall" | "peak";
export type SpectraWeight = "thin" | "medium" | "thick";
export type SpectraRegister = "high" | "mid" | "low";

export type SpectraGlyph = {
  /** Motif character (A–Z, 0–9, &). */
  char: string;
  hue: SpectraHue;
  length: SpectraLength;
  weight: SpectraWeight;
  register: SpectraRegister;
  /** True when this glyph ends a word — layout may widen the following gap. */
  wordBoundaryAfter: boolean;
  wordInitial: boolean;
};

export const SPECTRA_HUE_HEX: Record<SpectraHue, string> = {
  ice: "#7FB4FF",
  white: "#F2F0EB",
  amber: "#FFB56B",
  gray: "#8B8B96",
};

export const SPECTRA_LENGTH_PCT: Record<SpectraLength, number> = {
  short: 36,
  medium: 44,
  tall: 52,
  peak: 58,
};

/** Cover slit widths — medium is the body; thick is accent only. */
export const SPECTRA_WEIGHT_PCT: Record<SpectraWeight, number> = {
  thin: 1.05,
  medium: 1.7,
  thick: 2.55,
};

/** Vertical offset of the glow core from field center (% of cover). */
export const SPECTRA_REGISTER_OFFSET: Record<SpectraRegister, number> = {
  high: -14,
  mid: 0,
  low: 14,
};

const MOTIF_FLOOR = 14;
const MOTIF_CAP = 18;
const MOTIF_MAX_AFTER_PAD = 20;

const VOWELS = new Set(["A", "E", "I", "O", "U", "Y"]);
const RARE = new Set(["J", "Q", "X", "V", "K"]);
const BRIGHT = new Set(["S", "T", "C", "Z"]);
const WARM = new Set(["R", "B", "M", "P", "F", "W"]);
const COOL = new Set(["L", "N", "D", "G", "H"]);
const HIGH_REG = new Set(["B", "D", "F", "H", "K", "L", "T"]);
const LOW_REG = new Set(["G", "J", "P", "Q", "Y", "Z"]);

/**
 * English letter frequency bands (ETAOINSHRDLCUMWFGYPBVKJXQZ).
 * Common letters are the *body* (medium). Thick is reserved for accents
 * (rare letters + word-initials) so the field has real weight variance.
 */
const VERY_COMMON = new Set(["E", "T", "A", "O", "I", "N", "S", "H", "R"]); // medium
const MID_COMMON = new Set(["D", "L", "C", "U", "M", "W", "F", "G", "Y", "P"]); // thin–medium

type DigitSpec = {
  hue: SpectraHue;
  length: SpectraLength;
  weight: SpectraWeight;
  register: SpectraRegister;
};

const DIGITS: Record<string, DigitSpec> = {
  "0": { hue: "amber", length: "short", weight: "medium", register: "low" },
  "1": { hue: "ice", length: "short", weight: "medium", register: "high" },
  "2": { hue: "ice", length: "medium", weight: "medium", register: "mid" },
  "3": { hue: "white", length: "medium", weight: "medium", register: "mid" },
  "4": { hue: "white", length: "tall", weight: "medium", register: "high" },
  "5": { hue: "amber", length: "tall", weight: "medium", register: "mid" },
  "6": { hue: "amber", length: "peak", weight: "thick", register: "low" },
  "7": { hue: "gray", length: "medium", weight: "thick", register: "high" },
  "8": { hue: "white", length: "tall", weight: "medium", register: "mid" },
  "9": { hue: "ice", length: "peak", weight: "thick", register: "low" },
};

const AMPERSAND: DigitSpec = {
  hue: "white",
  length: "medium",
  weight: "thick",
  register: "mid",
};

/**
 * Normalize a title for motif extraction: keep parentheticals / featuring /
 * brackets as words (punctuation → spaces). Does not change stored titles.
 */
export function normalizeTitleForSpectra(title: string): string {
  return title
    .replace(/[()[\]{}]/g, " ")
    .replace(/[,.;:!?/\\|+'"`~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** @deprecated Use normalizeTitleForSpectra — featuring is kept in the motif. */
export function stripFeaturingForSpectra(title: string): string {
  return normalizeTitleForSpectra(title);
}

type MotifChar = {
  char: string;
  wordInitial: boolean;
  wordBoundaryAfter: boolean;
};

/**
 * Map a track title to a Spectra glyph score (about 12–18 glyphs).
 * Stable for the same title string.
 */
export function titleToSpectraScore(title: string): SpectraGlyph[] {
  const cleaned = normalizeTitleForSpectra(title);
  const motif = buildMotifChars(cleaned);
  const bounded = boundMotif(motif);
  return scoreMotif(bounded);
}

function buildMotifChars(cleaned: string): MotifChar[] {
  const words = cleaned
    .split(/\s+/)
    .map((w) => normalizeWord(w))
    .filter((w) => w.length > 0);

  if (words.length === 0) {
    return [{ char: "T", wordInitial: true, wordBoundaryAfter: false }];
  }

  const initials: MotifChar[] = [];
  const rest: MotifChar[] = [];

  words.forEach((word, wi) => {
    const chars = Array.from(word);
    chars.forEach((ch, ci) => {
      const entry: MotifChar = {
        char: ch,
        wordInitial: ci === 0,
        wordBoundaryAfter: ci === chars.length - 1 && wi < words.length - 1,
      };
      if (ci === 0) initials.push(entry);
      else rest.push({ ...entry, wordInitial: false });
    });
  });

  if (initials.length > 0 && rest.length === 0) {
    initials[initials.length - 1].wordBoundaryAfter = false;
  }

  return [...initials, ...rest];
}

function normalizeWord(word: string): string {
  const out: string[] = [];
  for (const raw of word) {
    if (/[a-z]/i.test(raw)) out.push(raw.toUpperCase());
    else if (/[0-9]/.test(raw)) out.push(raw);
    else if (raw === "&") out.push("&");
  }
  return out.join("");
}

function boundMotif(motif: MotifChar[]): MotifChar[] {
  let next = motif;

  if (next.length > MOTIF_CAP) {
    const initials = next.filter((m) => m.wordInitial);
    const extras = next.filter((m) => !m.wordInitial);
    const folded: MotifChar[] = [...initials];
    for (let i = 0; i < extras.length && folded.length < MOTIF_CAP; i += 2) {
      folded.push(extras[i]);
    }
    next = folded.slice(0, MOTIF_CAP);
  }

  if (next.length === 0) {
    next = [{ char: "T", wordInitial: true, wordBoundaryAfter: false }];
  }

  // Short titles: repeat / mirror until the field feels full.
  if (next.length < MOTIF_FLOOR) {
    const base = next.map((m, i) => ({
      ...m,
      wordBoundaryAfter: false,
      wordInitial: i === 0,
    }));

    while (next.length < MOTIF_FLOOR && next.length < MOTIF_MAX_AFTER_PAD) {
      const room = MOTIF_MAX_AFTER_PAD - next.length;
      if (room <= 0) break;

      // Alternate forward repeat and mirror so short motifs stay rhythmic.
      const cycle = Math.floor(next.length / Math.max(1, base.length));
      const chunk =
        cycle % 2 === 0
          ? base.map((m) => ({
              ...m,
              wordInitial: false,
              wordBoundaryAfter: false,
            }))
          : [...base].reverse().map((m) => ({
              ...m,
              wordInitial: false,
              wordBoundaryAfter: false,
            }));

      next = [...next, ...chunk.slice(0, room)];
    }
  }

  return next.slice(0, MOTIF_MAX_AFTER_PAD);
}

function scoreMotif(motif: MotifChar[]): SpectraGlyph[] {
  let runningHue: SpectraHue = "white";
  return motif.map((m) => {
    const glyph = charToGlyph(m.char, m.wordInitial, m.wordBoundaryAfter, runningHue);
    if (VOWELS.has(m.char)) {
      runningHue = vowelHue(m.char);
    }
    return glyph;
  });
}

function charToGlyph(
  char: string,
  wordInitial: boolean,
  wordBoundaryAfter: boolean,
  runningHue: SpectraHue
): SpectraGlyph {
  if (DIGITS[char]) {
    const d = DIGITS[char];
    return {
      char,
      hue: d.hue,
      length: d.length,
      weight: bumpWeight(d.weight, wordInitial),
      register: d.register,
      wordBoundaryAfter,
      wordInitial,
    };
  }

  if (char === "&") {
    return {
      char,
      ...AMPERSAND,
      weight: "thick",
      wordBoundaryAfter,
      wordInitial,
    };
  }

  if (VOWELS.has(char)) {
    // Vowels are among the most common letters — give them body, not hairlines.
    const hue = vowelHue(char);
    return {
      char,
      hue,
      length: alphabetLength(char),
      weight: bumpWeight(frequencyWeight(char), wordInitial),
      register: letterRegister(char),
      wordBoundaryAfter,
      wordInitial,
    };
  }

  if (RARE.has(char)) {
    return {
      char,
      hue: "gray",
      length: alphabetLength(char),
      weight: bumpWeight("thick", wordInitial),
      register: letterRegister(char),
      wordBoundaryAfter,
      wordInitial,
    };
  }

  let hue = runningHue;
  if (BRIGHT.has(char)) hue = nudgeHue(hue, "white");
  else if (WARM.has(char)) hue = nudgeHue(hue, "amber");
  else if (COOL.has(char)) hue = nudgeHue(hue, "ice");

  return {
    char,
    hue,
    length: alphabetLength(char),
    weight: bumpWeight(frequencyWeight(char), wordInitial),
    register: letterRegister(char),
    wordBoundaryAfter,
    wordInitial,
  };
}

/** Weight from English frequency — variance over uniform thickness. */
function frequencyWeight(char: string): SpectraWeight {
  if (VERY_COMMON.has(char)) return "medium"; // body of most titles
  if (MID_COMMON.has(char)) return "thin"; // breathing room
  return "thick"; // uncommon consonants as accents
}

function bumpWeight(weight: SpectraWeight, wordInitial: boolean): SpectraWeight {
  // Only word-initials of thin/medium become a downbeat; already-thick stays.
  if (!wordInitial) return weight;
  if (weight === "thin") return "medium";
  if (weight === "medium") return "thick";
  return "thick";
}

function vowelHue(char: string): SpectraHue {
  if (char === "A" || char === "O") return "amber";
  if (char === "E" || char === "I") return "ice";
  return "white"; // U, Y
}

function alphabetLength(char: string): SpectraLength {
  const code = char.charCodeAt(0) - 65; // A=0
  if (code <= 8) return code <= 4 ? "short" : "medium"; // A–I
  if (code <= 17) return code <= 13 ? "medium" : "tall"; // J–R
  return code <= 22 ? "tall" : "peak"; // S–Z
}

function letterRegister(char: string): SpectraRegister {
  if (HIGH_REG.has(char)) return "high";
  if (LOW_REG.has(char)) return "low";
  return "mid";
}

function nudgeHue(from: SpectraHue, toward: SpectraHue): SpectraHue {
  if (from === toward) return from;
  if (from === "gray") return toward;
  return toward;
}

/** Layout glyphs into cover-bar geometry (percent units). */
export type SpectraBarLayout = {
  x: number;
  y: number;
  h: number;
  w: number;
  color: string;
  opacity: number;
  delay: string;
  duration: string;
};

/** Per-composition knobs so two titles don't share the same silhouette. */
export type SpectraFieldProfile = {
  mode: 0 | 1 | 2 | 3 | 4 | 5;
  massCenter: number;
  spread: number;
  tallScale: number;
  gapScale: number;
  stagger: number;
  edgeDim: number;
  bgAngle: number;
  bgBias: "ice" | "amber" | "white" | "balanced";
  /** Vertical shift of the whole skyline (%). */
  baseline: number;
  /** Softness — applied as CSS blur px by the cover. */
  blurPx: number;
};

export function spectraFieldProfile(seed: number): SpectraFieldProfile {
  const r = (n: number) => ((seed * (n + 3) * 1103515245 + 12345) >>> 0) % 1000;
  const biases = ["ice", "amber", "white", "balanced"] as const;
  const mode = (r(0) % 6) as SpectraFieldProfile["mode"];

  // Dense presets — variation without sparseness; tallness stays mid-range.
  const presets: Record<
    SpectraFieldProfile["mode"],
    Partial<SpectraFieldProfile>
  > = {
    0: { massCenter: 0.5, spread: 0.22, tallScale: 1, gapScale: 0.55 },
    1: { massCenter: 0.4, spread: 0.26, tallScale: 0.92, gapScale: 0.7 },
    2: { massCenter: 0.6, spread: 0.24, tallScale: 1.06, gapScale: 0.6 },
    3: { massCenter: 0.5, spread: 0.3, tallScale: 0.98, gapScale: 0.8 },
    4: { massCenter: 0.44, spread: 0.2, tallScale: 1.08, gapScale: 0.5 },
    5: { massCenter: 0.56, spread: 0.28, tallScale: 0.95, gapScale: 0.65 },
  };

  const base = presets[mode];
  return {
    mode,
    massCenter: base.massCenter! + (r(1) / 1000) * 0.06 - 0.03,
    spread: base.spread! + (r(2) / 1000) * 0.05,
    tallScale: base.tallScale! + (r(3) / 1000) * 0.1 - 0.05,
    gapScale: base.gapScale! + (r(4) / 1000) * 0.12 - 0.06,
    stagger: 6 + (r(5) / 1000) * 16,
    edgeDim: 1.05 + (r(6) / 1000) * 1.1,
    bgAngle: 90 + (r(7) / 1000) * 80,
    bgBias: biases[r(8) % 4],
    baseline: -8 + (r(9) / 1000) * 16,
    blurPx: 1 + (r(10) % 3) * 0.35,
  };
}

/** Push glyph hues toward a track’s bias so color reads different per cover. */
export function applySpectraPaletteBias(
  glyphs: SpectraGlyph[],
  bias: SpectraFieldProfile["bgBias"]
): SpectraGlyph[] {
  if (bias === "balanced") return glyphs;
  return glyphs.map((g, i) => {
    if (i % 3 === 2) return g; // keep accents
    if (bias === "ice") {
      return {
        ...g,
        hue: g.hue === "amber" ? "ice" : g.hue === "gray" ? "white" : g.hue === "white" ? "ice" : g.hue,
      };
    }
    if (bias === "amber") {
      return {
        ...g,
        hue: g.hue === "ice" ? "amber" : g.hue === "gray" ? "amber" : g.hue,
      };
    }
    // white-led
    return {
      ...g,
      hue: g.hue === "amber" ? "white" : g.hue === "ice" ? "white" : g.hue,
    };
  });
}

const LENGTH_SCALE: Record<SpectraLength, number> = {
  short: 0.88,
  medium: 1,
  tall: 1.1,
  peak: 1.18,
};

const WEIGHT_SCALE: Record<SpectraWeight, number> = {
  thin: 0.65,
  medium: 1,
  thick: 1.55,
};

export function layoutSpectraCoverBars(
  glyphs: SpectraGlyph[],
  seed = 1
): SpectraBarLayout[] {
  if (glyphs.length === 0) return [];

  const profile = spectraFieldProfile(seed);
  const used = applySpectraPaletteBias(glyphs, profile.bgBias);

  const gaps: number[] = used.map((g, i) => {
    const wordGap = g.wordBoundaryAfter ? 1.35 : 1;
    const breath = 1 + (((seed + i * 17) % 6) === 0 ? 0.35 : 0);
    const rhythm =
      profile.mode === 3 && i % 2 === 1 ? 1.35 : profile.mode === 4 && i % 3 === 0 ? 0.7 : 1;
    return wordGap * breath * rhythm * profile.gapScale;
  });
  const gapSum = gaps.reduce((a, b) => a + b, 0) || 1;
  const left = 4;
  const span = 92;
  let cursor = 0;

  return used.map((g, i) => {
    const slot = gaps[i] / gapSum;
    const xCenter = left + span * (cursor + slot / 2);
    cursor += slot;

    const dist = Math.abs(xCenter / 100 - profile.massCenter) / profile.spread;
    const envelope = Math.max(0.28, Math.exp(-dist * dist * profile.edgeDim));

    const h =
      SPECTRA_LENGTH_PCT[g.length] *
      profile.tallScale *
      LENGTH_SCALE[g.length] *
      (0.55 + envelope * 0.55);

    const wavePhase = (seed % 5) + 1;
    const wave =
      Math.sin((i / Math.max(1, used.length - 1)) * Math.PI * wavePhase) *
      profile.stagger;

    const y =
      50 -
      h / 2 +
      SPECTRA_REGISTER_OFFSET[g.register] * 1.1 +
      wave +
      profile.baseline;

    const jitter =
      0.8 + ((((seed + g.char.charCodeAt(0) * 13 + i * 19) % 100) / 100) * 0.45);
    const w =
      SPECTRA_WEIGHT_PCT[g.weight] *
      WEIGHT_SCALE[g.weight] *
      (0.8 + envelope * 0.35) *
      jitter;

    const opacity = 0.22 + envelope * 0.72 + ((i * 7 + seed) % 9) / 100;

    const phase = ((seed * 17 + i * 47) % 400) / 10;
    const dur = 28 + ((seed + i * 13) % 36);

    return {
      x: xCenter - w / 2,
      y: clamp(y, 2, 92),
      h: clamp(h, 12, 90),
      w: clamp(w, 0.75, 3.8),
      color: SPECTRA_HUE_HEX[g.hue],
      opacity: Math.min(0.97, opacity),
      delay: `${-phase}s`,
      duration: `${dur}s`,
    };
  });
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
