/**
 * Shared Tempo Theme ambient bed — Origin soundtrack reused on auth and the
 * daily boot intro so the first minute of TEMPO feels continuous.
 */

export const TEMPO_THEME_SRC = "/onboarding/origin/tempo-theme.mp3";
export const TEMPO_THEME_VOLUME = 0.16;
export const TEMPO_THEME_FADE_IN_MS = 1400;
export const TEMPO_THEME_FADE_OUT_MS = 900;

export function fadeAudioTo(
  audio: HTMLAudioElement,
  targetVolume: number,
  durationMs: number,
  onDone?: () => void
): () => void {
  const from = audio.volume;
  const startedAt = performance.now();
  let raf = 0;
  let cancelled = false;

  const tick = (now: number) => {
    if (cancelled) return;
    const progress = durationMs <= 0 ? 1 : Math.min(1, (now - startedAt) / durationMs);
    audio.volume = from + (targetVolume - from) * progress;
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
