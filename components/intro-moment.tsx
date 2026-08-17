"use client";

import * as React from "react";
import { setIntroActive, setLightfieldPaused } from "@/lib/lightfield";
import {
  INTRO_DAY_KEY,
  INTRO_POSTER,
  INTRO_SOURCES,
  clearIntroPending,
  introDayKey,
  introWillPlay,
} from "@/lib/intro";
import { LfWindow } from "@/components/lf-windows";
import { cn } from "@/lib/utils";

/** Last stretch of the film cross-fades into the workspace underneath. */
const FADE_OUT_SECONDS = 2;
const SKIP_FADE_MS = 480;
const SKIP_HINT_AFTER_MS = 600;
/** Generous ceiling so a longer film is never cut off mid-play. */
const SAFETY_TIMEOUT_MS = 60000;
/** Longest we'll sit on black waiting for enough video to play smoothly. */
const BUFFER_WAIT_MS = 2500;

/**
 * Boot intro: the supplied TEMPO film plays full-bleed with its authored logo
 * and soundtrack, a grain layer over the footage, then a two-second fade into
 * the workspace during the film's last beats. Once per calendar day; skipped
 * under prefers-reduced-motion.
 *
 * Playback runs as a plain composited <video>. The root Lightfield is paused
 * while the overlay is opaque so the video gets the GPU, then released as the
 * fade begins so the dashboard is actually there to dissolve onto.
 */
export function IntroMoment({
  onDone,
}: {
  onDone?: () => void;
}) {
  const [phase, setPhase] = React.useState<
    "checking" | "playing" | "done"
  >("checking");
  const [showSkipHint, setShowSkipHint] = React.useState(false);
  const [fading, setFading] = React.useState(false);
  const [skipFade, setSkipFade] = React.useState(false);

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const phaseRef = React.useRef(phase);
  phaseRef.current = phase;
  const fadingRef = React.useRef(false);
  const skipFadeRef = React.useRef(false);
  const gateRanRef = React.useRef(false);
  const finishTimerRef = React.useRef<number | null>(null);

  const finish = React.useCallback(() => {
    setIntroActive(false);
    setLightfieldPaused(false);
    clearIntroPending();
    setPhase((p) => (p === "done" ? p : "done"));
    onDone?.();
  }, [onDone]);

  const beginFade = React.useCallback((fromSkip = false) => {
    if (fadingRef.current) return;
    fadingRef.current = true;
    skipFadeRef.current = fromSkip;
    // Reveal the workspace under the overlay before opacity drops, otherwise
    // the intro cover / hidden chrome would show through as black.
    setIntroActive(false);
    setLightfieldPaused(false);
    clearIntroPending();
    if (fromSkip) setSkipFade(true);
    setFading(true);
    const ms = fromSkip ? SKIP_FADE_MS : FADE_OUT_SECONDS * 1000;
    if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current);
    finishTimerRef.current = window.setTimeout(finish, ms + 80);
  }, [finish]);

  const skip = React.useCallback(() => {
    if (phaseRef.current !== "playing") return;
    const video = videoRef.current;
    if (video && !video.muted) video.volume = 0;
    beginFade(true);
  }, [beginFade]);

  // Gate: reduced motion, or already played today. Guarded against
  // React Strict Mode's dev-only double effect invocation — without this,
  // the second run would see the day-flag the first run just wrote and
  // immediately (wrongly) jump to "done".
  React.useEffect(() => {
    if (gateRanRef.current) return;
    gateRanRef.current = true;
    if (typeof window === "undefined") return;

    if (!introWillPlay()) {
      clearIntroPending();
      setPhase("done");
      onDone?.();
      return;
    }

    setPhase("playing");
    try {
      localStorage.setItem(INTRO_DAY_KEY, introDayKey());
    } catch {
      /* private mode */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (phase !== "playing") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") skip();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, skip]);

  // Hide chrome only while the overlay is still opaque. Written as a plain
  // set (no cleanup-then-reapply) so the fade can't thrash the attribute.
  React.useEffect(() => {
    const covering = phase === "playing" && !fading;
    setIntroActive(covering);
    setLightfieldPaused(covering);
    if (covering) clearIntroPending();
  }, [phase, fading]);

  React.useEffect(
    () => () => {
      setIntroActive(false);
      setLightfieldPaused(false);
      if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current);
    },
    []
  );

  // Safety net: never get stuck, but never shorter than a full film.
  React.useEffect(() => {
    if (phase === "checking" || phase === "done") return;
    const t = window.setTimeout(finish, SAFETY_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [phase, finish]);

  // Play the supplied film through to its authored ending. The last two
  // seconds cross-fade into the workspace; `ended` finishes if the fade
  // transition doesn't.
  React.useEffect(() => {
    if (phase !== "playing") return;
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    let hintTimer: number | null = null;
    let bufferTimer: number | null = null;
    let started = false;

    const duckAudio = () => {
      if (video.muted || skipFadeRef.current) return;
      const duration = video.duration;
      if (!duration || !Number.isFinite(duration)) return;
      const remaining = Math.max(0, duration - video.currentTime);
      video.volume = Math.max(
        0,
        Math.min(1, remaining / FADE_OUT_SECONDS)
      );
    };

    const onTimeUpdate = () => {
      if (cancelled) return;
      const duration = video.duration;
      if (!duration || !Number.isFinite(duration)) return;
      const remaining = duration - video.currentTime;
      if (remaining <= FADE_OUT_SECONDS) {
        beginFade(false);
        duckAudio();
      }
    };

    const onEnded = () => {
      if (!cancelled) finish();
    };

    const onError = () => {
      if (!cancelled) finish();
    };

    // Don't start into a stall — the overlay is already opaque black, so
    // waiting here is invisible, whereas playing unbuffered stutters through
    // the ignition. The login-screen preloader usually makes this instant.
    const start = () => {
      if (started || cancelled) return;
      started = true;
      if (bufferTimer) window.clearTimeout(bufferTimer);
      video.removeEventListener("canplaythrough", start);
      video
        .play()
        .catch(() => {
          // Browsers may block audible autoplay after navigation. Preserve the
          // film instead of dropping the whole intro when that happens.
          video.muted = true;
          return video.play();
        })
        .catch(() => {
          if (!cancelled) finish();
        });
      hintTimer = window.setTimeout(
        () => setShowSkipHint(true),
        SKIP_HINT_AFTER_MS
      );
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("ended", onEnded);
    video.addEventListener("error", onError);

    if (video.readyState >= 4 /* HAVE_ENOUGH_DATA */) {
      start();
    } else {
      video.addEventListener("canplaythrough", start);
      // Slow connection: go anyway rather than hold a black screen.
      bufferTimer = window.setTimeout(start, BUFFER_WAIT_MS);
    }

    return () => {
      cancelled = true;
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("error", onError);
      video.removeEventListener("canplaythrough", start);
      if (hintTimer) window.clearTimeout(hintTimer);
      if (bufferTimer) window.clearTimeout(bufferTimer);
    };
  }, [phase, finish, beginFade]);

  if (phase === "checking" || phase === "done") return null;

  return (
    <div
      data-lf-intro-layer
      role="dialog"
      aria-label="Daily introduction"
      className={cn(
        "fixed inset-0 z-[300] flex items-center justify-center overflow-hidden bg-bg-0",
        "transition-opacity ease-out",
        fading && "opacity-0"
      )}
      style={{
        transitionDuration: skipFade
          ? `${SKIP_FADE_MS}ms`
          : `${FADE_OUT_SECONDS * 1000}ms`,
      }}
      onTransitionEnd={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.propertyName === "opacity" && fading) finish();
      }}
    >
      {/* Plain composited playback — no per-frame GPU upload. */}
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        preload="auto"
        poster={INTRO_POSTER}
      >
        {INTRO_SOURCES.map((s) => (
          <source key={s.src} src={s.src} type={s.type} />
        ))}
      </video>

      <div aria-hidden className="intro-grain" />

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          skip();
        }}
        aria-hidden={!showSkipHint}
        tabIndex={showSkipHint ? 0 : -1}
        className={cn(
          "pointer-events-auto absolute bottom-8 left-1/2 z-10 -translate-x-1/2",
          "rounded-chip border border-white/25 bg-black/50 px-4 py-1.5 backdrop-blur-sm",
          "font-sans text-xs uppercase tracking-[0.14em] text-text-hi",
          "transition-[opacity,color,border-color,background-color] duration-hover",
          "hover:border-white/40 hover:bg-black/65",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice",
          showSkipHint && !fading
            ? "opacity-100"
            : "pointer-events-none opacity-0"
        )}
      >
        Skip
      </button>
    </div>
  );
}

/**
 * Top edge Lightfield window strip (height via --edge-strip-h). Also doubles
 * as part of the desktop app's window-drag handle — `-webkit-app-region` is
 * a no-op outside Electron, so this is safe to set unconditionally rather
 * than gating it behind isDesktopApp(). See components/app-shell.tsx's
 * sticky toolbar row for the rest of the draggable strip.
 */
export function EdgeStrip() {
  return (
    <LfWindow
      className="edge-strip lf-window sticky top-0 z-50 shrink-0 [-webkit-app-region:drag]"
      aria-hidden
    />
  );
}
