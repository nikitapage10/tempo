/**
 * Shared Tempo Theme ambient bed — Origin soundtrack reused on auth and the
 * daily boot intro so the first minute of TEMPO feels continuous.
 */

export const TEMPO_THEME_SRC = "/onboarding/origin/tempo-theme.mp3";
export const TEMPO_THEME_VOLUME = 0.22;
export const TEMPO_THEME_FADE_IN_MS = 1400;
export const TEMPO_THEME_FADE_OUT_MS = 900;

/**
 * HTMLMediaElement.volume must stay in [0, 1] — a value outside that range
 * throws, which aborts any fade loop mid-flight and leaves the bed silent.
 *
 * requestAnimationFrame's first `now` can land a hair before a `performance.now()`
 * captured just before scheduling, so unclamped fade progress goes negative.
 */
export function clampMediaVolume(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

export function fadeProgress(now: number, startedAt: number, durationMs: number): number {
  if (durationMs <= 0) return 1;
  return clampMediaVolume((now - startedAt) / durationMs);
}

export function fadeAudioTo(
  audio: HTMLAudioElement,
  targetVolume: number,
  durationMs: number,
  onDone?: () => void
): () => void {
  const from = clampMediaVolume(audio.volume);
  const to = clampMediaVolume(targetVolume);
  const startedAt = performance.now();
  let raf = 0;
  let cancelled = false;

  const tick = (now: number) => {
    if (cancelled) return;
    const progress = fadeProgress(now, startedAt, durationMs);
    audio.volume = clampMediaVolume(from + (to - from) * progress);
    if (progress < 1) {
      raf = requestAnimationFrame(tick);
      return;
    }
    onDone?.();
  };

  raf = requestAnimationFrame(tick);
  return () => {
    cancelled = true;
    cancelAnimationFrame(raf);
  };
}

export function startTempoThemeBed(audio: HTMLAudioElement, volume = TEMPO_THEME_VOLUME) {
  audio.loop = true;
  audio.volume = 0;
  const play = audio.play();
  if (play && typeof play.catch === "function") {
    play.catch(() => {
      /* autoplay blocked until a gesture — callers retry on interaction */
    });
  }
  return fadeAudioTo(audio, volume, TEMPO_THEME_FADE_IN_MS);
}

export function stopTempoThemeBed(audio: HTMLAudioElement) {
  return new Promise<void>((resolve) => {
    fadeAudioTo(audio, 0, TEMPO_THEME_FADE_OUT_MS, () => {
      audio.pause();
      audio.currentTime = 0;
      resolve();
    });
  });
}

/** Cut immediately — closing TEMPO to the tray must not keep a fade playing. */
export function hushTempoThemeBed(audio: HTMLAudioElement) {
  audio.pause();
  audio.volume = 0;
}
