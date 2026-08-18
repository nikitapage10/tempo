"use client";

import * as React from "react";

/**
 * Live 0..1 loudness for a microphone track, read straight off the audio
 * graph. Used for the meter beside the mic button and in A/V settings, so
 * "is this thing on" is answerable without asking somebody else to listen.
 */
export function useMicLevel(track: MediaStreamTrack | null | undefined, active = true): number {
  const [level, setLevel] = React.useState(0);

  React.useEffect(() => {
    if (!track || !active || typeof window === "undefined") {
      setLevel(0);
      return;
    }
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    let raf = 0;
    const context = new AudioCtx();
    const source = context.createMediaStreamSource(new MediaStream([track]));
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.75;
    source.connect(analyser);
    const buffer = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteTimeDomainData(buffer);
      let peak = 0;
      for (let i = 0; i < buffer.length; i += 1) {
        peak = Math.max(peak, Math.abs(buffer[i] - 128) / 128);
      }
      // A little headroom so normal speech fills most of the meter.
      setLevel(Math.min(1, peak * 1.6));
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(raf);
      try {
        source.disconnect();
        analyser.disconnect();
      } catch {
        /* already torn down */
      }
      void context.close().catch(() => {});
    };
  }, [active, track]);

  return level;
}
