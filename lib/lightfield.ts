/**
 * Lightfield driver — owns eased uniforms and app→light mappings.
 * One continuous field; the UI opens windows onto it (see spectra-lightfield-v2.md).
 */

import {
  LIGHTFIELD_DEFAULTS,
  ORIGINAL_COOL_RGB,
  ORIGINAL_MID_RGB,
  ORIGINAL_WARM_RGB,
} from "@/lib/shader-glsl";

export type LightfieldUniforms = {
  uSpeed: number;
  uIntensity: number;
  uWarmth: number;
  uSeed: number;
  uIce: [number, number, number];
  uAmber: [number, number, number];
  uWhite: [number, number, number];
};

const EASE_MS = 800;
const SWEEP_MS = 1200;
const BASE_SPEED = LIGHTFIELD_DEFAULTS.uSpeed;
const BASE_INTENSITY = LIGHTFIELD_DEFAULTS.uIntensity;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function cloneRgb(rgb: [number, number, number]): [number, number, number] {
  return [rgb[0], rgb[1], rgb[2]];
}

function cloneUniforms(u: LightfieldUniforms): LightfieldUniforms {
  return {
    uSpeed: u.uSpeed,
    uIntensity: u.uIntensity,
    uWarmth: u.uWarmth,
    uSeed: u.uSeed,
    uIce: cloneRgb(u.uIce),
    uAmber: cloneRgb(u.uAmber),
    uWhite: cloneRgb(u.uWhite),
  };
}

type Listener = () => void;

let current: LightfieldUniforms = cloneUniforms(LIGHTFIELD_DEFAULTS);
let target: LightfieldUniforms = cloneUniforms(LIGHTFIELD_DEFAULTS);
/** Debug panel hard-overrides (null = follow driver targets). */
let debugOverride: Partial<LightfieldUniforms> | null = null;
let introActive = false;
let renderPaused = false;
let sweepBoost = 1;
let sweepUntil = 0;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
}

export function subscribeLightfield(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLightfieldUniforms(): LightfieldUniforms {
  return cloneUniforms(current);
}

export function getLightfieldTargets(): LightfieldUniforms {
  return cloneUniforms(target);
}

export function isLightfieldKillSwitch(): boolean {
  return process.env.NEXT_PUBLIC_LIGHTFIELD === "off";
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Advance eased uniforms toward targets. Call once per rAF from the canvas. */
export function tickLightfield(dtMs: number): LightfieldUniforms {
  const now = typeof performance !== "undefined" ? performance.now() : 0;
  if (sweepUntil > 0 && now >= sweepUntil) {
    sweepBoost = 1;
    sweepUntil = 0;
  }

  const blend = 1 - Math.exp((-dtMs / EASE_MS) * 4);
  const desired: LightfieldUniforms = {
    uSpeed: debugOverride?.uSpeed ?? target.uSpeed,
    uIntensity: (debugOverride?.uIntensity ?? target.uIntensity) * sweepBoost,
    uWarmth: debugOverride?.uWarmth ?? target.uWarmth,
    uSeed: debugOverride?.uSeed ?? target.uSeed,
    uIce: debugOverride?.uIce ?? target.uIce,
    uAmber: debugOverride?.uAmber ?? target.uAmber,
    uWhite: debugOverride?.uWhite ?? target.uWhite,
  };

  current = {
    uSpeed: lerp(current.uSpeed, desired.uSpeed, blend),
    uIntensity: lerp(current.uIntensity, desired.uIntensity, blend),
    uWarmth: lerp(current.uWarmth, desired.uWarmth, blend),
    uSeed: lerp(current.uSeed, desired.uSeed, blend),
    uIce: lerpRgb(current.uIce, desired.uIce, blend),
    uAmber: lerpRgb(current.uAmber, desired.uAmber, blend),
    uWhite: lerpRgb(current.uWhite, desired.uWhite, blend),
  };

  return getLightfieldUniforms();
}

function setTarget(partial: Partial<LightfieldUniforms>) {
  target = { ...target, ...partial };
  notify();
}

/** Tempo-sync: light drifts at the track's BPM (120 BPM = default speed). */
export function setTempoFromBpm(bpm: number | null | undefined) {
  if (bpm == null || !Number.isFinite(bpm) || bpm <= 0) {
    setTarget({ uSpeed: BASE_SPEED });
    return;
  }
  setTarget({
    uSpeed: clamp(BASE_SPEED * (bpm / 120), BASE_SPEED * 0.45, BASE_SPEED * 2.2),
  });
}

/**
 * Stage warmth −0.8…+0.8 from normalized stage position (0 = earliest, 1 = latest).
 * Neutral (Today / no stage) → 0.
 */
export function setWarmthFromStageProgress(progress: number | null | undefined) {
  if (progress == null || !Number.isFinite(progress)) {
    setTarget({ uWarmth: 0 });
    return;
  }
  const t = clamp(progress, 0, 1);
  setTarget({ uWarmth: -0.8 + t * 1.6 });
}

/**
 * Ambient activity: this week's sessions + version uploads → intensity ×0.7–×1.4.
 */
export function setIntensityFromWeeklyActivity(count: number) {
  const n = Math.max(0, count);
  const mult = clamp(0.7 + n * 0.07, 0.7, 1.4);
  setTarget({ uIntensity: BASE_INTENSITY * mult });
}

export function setSeed(seed: number) {
  setTarget({ uSeed: seed });
}

/**
 * Artist palette → lightfield line colours.
 *
 * Spectra (default) with no custom accents uses the original cool/mid/warm →
 * B/G/R channel basis so the field is pixel-identical to classic TEMPO.
 * Other palettes and any custom Cool/Warm remaps onto ice → white → amber.
 */
export function setPaletteFromHues(
  hues: {
    ice: string;
    amber: string;
    white?: string;
  },
  paletteId?: string | null,
  opts?: { custom?: boolean }
) {
  const isSpectra =
    !opts?.custom && (!paletteId || paletteId === "spectra");
  if (isSpectra) {
    setTarget({
      uIce: cloneRgb(ORIGINAL_COOL_RGB),
      uAmber: cloneRgb(ORIGINAL_WARM_RGB),
      uWhite: cloneRgb(ORIGINAL_MID_RGB),
    });
    return;
  }
  setTarget({
    uIce: hexToRgb01(hues.ice),
    uAmber: hexToRgb01(hues.amber),
    uWhite: hexToRgb01(hues.white ?? "#FFFFFF"),
  });
}

function hexToRgb01(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full =
    h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (!Number.isFinite(n)) {
    return cloneRgb(LIGHTFIELD_DEFAULTS.uIce);
  }
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Reward pulse: intensity ×2, eases back over 1.2s. No-op under reduced motion. */
export function sweep() {
  if (typeof window === "undefined") return;
  if (prefersReducedMotion()) return;
  sweepBoost = 2;
  sweepUntil = performance.now() + SWEEP_MS;
  notify();
}

export function setDebugOverride(partial: Partial<LightfieldUniforms> | null) {
  debugOverride = partial;
  if (partial) {
    current = { ...current, ...partial };
  }
  notify();
}

export function getDebugOverride(): Partial<LightfieldUniforms> | null {
  return debugOverride ? { ...debugOverride } : null;
}

/** Intro: punch a full-viewport window through chrome so the field is visible. */
export function setIntroActive(active: boolean) {
  introActive = active;
  if (typeof document !== "undefined") {
    if (active) document.documentElement.setAttribute("data-lf-intro", "");
    else document.documentElement.removeAttribute("data-lf-intro");
  }
  notify();
}

export function isIntroActive() {
  return introActive;
}

/**
 * Stop the field from rendering while something opaque covers it.
 *
 * The field shader is a 15-iteration loop per pixel over the full viewport,
 * so leaving it running behind the boot video just starves the video decode
 * for GPU. The rAF loop keeps ticking — only the draw is skipped — so it
 * resumes instantly.
 */
export function setLightfieldPaused(paused: boolean) {
  renderPaused = paused;
  notify();
}

export function isLightfieldPaused() {
  return renderPaused;
}

/** Map stage index within an ordered list → 0…1 progress. */
export function stageProgress(
  stageId: string | null | undefined,
  stages: { id: string; sort: number }[]
): number | null {
  if (!stageId || stages.length === 0) return null;
  const sorted = [...stages].sort((a, b) => a.sort - b.sort);
  const idx = sorted.findIndex((s) => s.id === stageId);
  if (idx < 0) return null;
  if (sorted.length === 1) return 0.5;
  return idx / (sorted.length - 1);
}

/** Average stage progress across tracks (board warmth). */
export function averageStageProgress(
  tracks: { stage_id: string | null }[],
  stages: { id: string; sort: number }[]
): number | null {
  if (!tracks.length || !stages.length) return null;
  let sum = 0;
  let n = 0;
  for (const t of tracks) {
    const p = stageProgress(t.stage_id, stages);
    if (p != null) {
      sum += p;
      n += 1;
    }
  }
  if (n === 0) return null;
  return sum / n;
}

export function resetLightfieldDefaults() {
  target = cloneUniforms(LIGHTFIELD_DEFAULTS);
  current = cloneUniforms(LIGHTFIELD_DEFAULTS);
  debugOverride = null;
  sweepBoost = 1;
  sweepUntil = 0;
  notify();
}
