"use client";

import * as React from "react";
import type { ShaderMaterial, VideoTexture, WebGLRenderer } from "three";
import { setIntroActive } from "@/lib/lightfield";
import {
  FRAGMENT_SHADER,
  VERTEX_SHADER,
} from "@/lib/intro-shader-glsl";
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

const WORDMARK_START = 2.2; // s — per-character reveal begins
const WORDMARK_STAGGER = 0.09; // s between characters
const WORDMARK_SETTLE = 0.42; // s per character fade/blur/rise
const MELT_START = 7.6; // s — dispersion melt begins
const MELT_DURATION_MS = 1100;
/** The whole overlay (black backdrop included) dissolves over the tail of the
 *  melt, so the streaks stay full-strength briefly before the app shows through. */
const MELT_FADE_DELAY_MS = 350;
const SKIP_HINT_AFTER_MS = 1200;
const SAFETY_TIMEOUT_MS = 12000;
/** Longest we'll sit on black waiting for enough video to play smoothly. */
const BUFFER_WAIT_MS = 2500;
const DPR_CAP = 1.5;
const MAX_INTERNAL_PIXELS = 1280 * 720;

const CHARS = ["T", "E", "M", "P", "O"];

/**
 * Boot intro: the TEMPO INTRO video plays full-bleed, the wordmark reveals
 * character by character over it, then a GLSL dispersion pass melts the
 * frame apart while the app fades up underneath. Once per calendar day;
 * skipped under prefers-reduced-motion.
 *
 * Rendering uses a short-lived second WebGL context (disposed on unmount) —
 * a deliberate exception to the "one context for the whole app" rule in
 * components/lightfield.tsx, scoped to ~9s once a day.
 */
export function IntroMoment({
  onDone,
}: {
  onDone?: () => void;
}) {
  const [phase, setPhase] = React.useState<
    "checking" | "playing" | "melting" | "done"
  >("checking");
  const [glFailed, setGlFailed] = React.useState(false);
  const [charsOn, setCharsOn] = React.useState<boolean[]>(() =>
    CHARS.map(() => false)
  );
  const [showSkipHint, setShowSkipHint] = React.useState(false);

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const meltRef = React.useRef<{ value: number }>({ value: 0 });
  const phaseRef = React.useRef(phase);
  phaseRef.current = phase;
  const gateRanRef = React.useRef(false);

  const finish = React.useCallback(() => {
    setIntroActive(false);
    clearIntroPending();
    setPhase((p) => (p === "done" ? p : "done"));
    onDone?.();
  }, [onDone]);

  const skipToMelt = React.useCallback(() => {
    if (phaseRef.current !== "playing") return;
    setPhase("melting");
  }, []);

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

  // Keyboard skip (click-to-skip is handled directly on the overlay).
  React.useEffect(() => {
    if (phase !== "playing") return;
    const onKeyDown = () => skipToMelt();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, skipToMelt]);

  // Chrome punch-through while intro is on screen.
  React.useEffect(() => {
    if (phase === "playing" || phase === "melting") {
      setIntroActive(true);
      return () => setIntroActive(false);
    }
    setIntroActive(false);
  }, [phase]);

  // Safety net: never get stuck.
  React.useEffect(() => {
    if (phase === "checking" || phase === "done") return;
    const t = window.setTimeout(finish, SAFETY_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [phase, finish]);

  // Video playback + timeline (character reveal, melt trigger) driven off
  // currentTime so a decode stall can't desync text from picture.
  React.useEffect(() => {
    if (phase !== "playing") return;
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    let meltTriggered = false;
    let hintTimer: number | null = null;

    const onTimeUpdate = () => {
      const t = video.currentTime;
      if (t >= WORDMARK_START) {
        setCharsOn((prev) => {
          const idx = Math.min(
            CHARS.length,
            Math.floor((t - WORDMARK_START) / WORDMARK_STAGGER) + 1
          );
          const next = CHARS.map((_, i) => i < idx);
          return next.every((v, i) => v === prev[i]) ? prev : next;
        });
      }
      if (t >= MELT_START && !meltTriggered) {
        meltTriggered = true;
        setPhase("melting");
      }
    };

    const onEnded = () => {
      if (!meltTriggered) setPhase("melting");
    };

    const onError = () => {
      if (!cancelled) finish();
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("ended", onEnded);
    video.addEventListener("error", onError);

    // Don't start into a stall — the overlay is already opaque black, so
    // waiting here is invisible, whereas playing unbuffered stutters through
    // the ignition. The login-screen preloader usually makes this instant.
    let started = false;
    let bufferTimer: number | null = null;

    const start = () => {
      if (started || cancelled) return;
      started = true;
      if (bufferTimer) window.clearTimeout(bufferTimer);
      video.removeEventListener("canplaythrough", start);
      video.play().catch(() => {
        if (!cancelled) finish();
      });
      hintTimer = window.setTimeout(
        () => setShowSkipHint(true),
        SKIP_HINT_AFTER_MS
      );
    };

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
  }, [phase, finish]);

  // Melt: ramp uMelt (or CSS fallback), release chrome, then finish.
  React.useEffect(() => {
    if (phase !== "melting") return;
    setIntroActive(false);
    // Must drop with the chrome — the pre-paint cover is opaque, so leaving
    // it up would block the app from showing through the dissolve.
    clearIntroPending();

    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / MELT_DURATION_MS);
      meltRef.current.value = t;
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        finish();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, finish]);

  // WebGL melt renderer. Falls back to CSS-only melt on the raw <video> if
  // context creation fails.
  React.useEffect(() => {
    if (phase !== "playing" && phase !== "melting") return;
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video) return;

    let cancelled = false;
    let renderer: WebGLRenderer | null = null;
    let material: ShaderMaterial | null = null;
    let texture: VideoTexture | null = null;
    let animationId: number | null = null;
    let onResize: (() => void) | null = null;

    void (async () => {
      const THREE = await import("three");
      if (cancelled || !containerRef.current) return;

      try {
        renderer = new THREE.WebGLRenderer({
          antialias: false,
          alpha: false,
          powerPreference: "low-power",
        });
      } catch {
        setGlFailed(true);
        return;
      }
      if (!renderer.getContext()) {
        renderer.dispose();
        renderer = null;
        setGlFailed(true);
        return;
      }

      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const scene = new THREE.Scene();
      const geometry = new THREE.PlaneGeometry(2, 2);

      texture = new THREE.VideoTexture(video);
      texture.colorSpace = THREE.SRGBColorSpace;

      const uniforms = {
        uTex: { value: texture },
        uMelt: { value: 0 },
        uResolution: { value: new THREE.Vector2() },
        uTexAspect: { value: 16 / 9 },
        uTime: { value: 0 },
      };

      material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
      });

      scene.add(new THREE.Mesh(geometry, material));

      const canvas = renderer.domElement;
      canvas.style.display = "block";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      container.innerHTML = "";
      container.appendChild(canvas);

      onResize = () => {
        if (!renderer) return;
        const cssW = Math.max(1, window.innerWidth);
        const cssH = Math.max(1, window.innerHeight);
        const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
        let w = Math.floor(cssW * dpr);
        let h = Math.floor(cssH * dpr);
        const pixels = w * h;
        if (pixels > MAX_INTERNAL_PIXELS) {
          const scale = Math.sqrt(MAX_INTERNAL_PIXELS / pixels);
          w = Math.max(1, Math.floor(w * scale));
          h = Math.max(1, Math.floor(h * scale));
        }
        renderer.setSize(w, h, false);
        uniforms.uResolution.value.set(w, h);
      };
      onResize();
      window.addEventListener("resize", onResize);

      const animate = (ts: number) => {
        animationId = requestAnimationFrame(animate);
        if (!renderer) return;
        uniforms.uTime.value = ts / 1000;
        uniforms.uMelt.value = meltRef.current.value;
        if (video.videoWidth && video.videoHeight) {
          uniforms.uTexAspect.value = video.videoWidth / video.videoHeight;
        }
        renderer.render(scene, camera);
      };
      animationId = requestAnimationFrame(animate);
    })();

    return () => {
      cancelled = true;
      if (animationId != null) cancelAnimationFrame(animationId);
      if (onResize) window.removeEventListener("resize", onResize);
      texture?.dispose();
      material?.dispose();
      if (renderer) {
        renderer.dispose();
        if (renderer.domElement.parentNode === container) {
          container.removeChild(renderer.domElement);
        }
      }
    };
  }, [phase]);

  if (phase === "checking" || phase === "done") return null;

  const meltingCss = phase === "melting";

  return (
    <div
      data-lf-intro-layer
      className={cn(
        "fixed inset-0 z-[300] flex items-center justify-center overflow-hidden bg-bg-0",
        "transition-opacity ease-out",
        meltingCss && "opacity-0"
      )}
      style={{
        transitionDuration: `${MELT_DURATION_MS - MELT_FADE_DELAY_MS}ms`,
        transitionDelay: meltingCss ? `${MELT_FADE_DELAY_MS}ms` : "0ms",
      }}
      aria-hidden
      role="presentation"
      onClick={skipToMelt}
    >
      <video
        ref={videoRef}
        className={cn(
          "absolute inset-0 h-full w-full object-cover",
          !glFailed && "opacity-0",
          glFailed &&
            "transition-[filter,opacity,transform] ease-out" +
              (meltingCss ? " scale-125 opacity-0 blur-2xl" : "")
        )}
        style={
          glFailed && meltingCss
            ? { transitionDuration: `${MELT_DURATION_MS}ms` }
            : undefined
        }
        muted
        playsInline
        preload="auto"
        poster={INTRO_POSTER}
      >
        {INTRO_SOURCES.map((s) => (
          <source key={s.src} src={s.src} type={s.type} />
        ))}
      </video>

      {!glFailed ? (
        <div
          ref={containerRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
      ) : null}

      <span
        aria-label="TEMPO"
        role="img"
        className={cn(
          "relative z-10 inline-flex select-none font-display font-light leading-none text-text-hi/90 transition-[filter,opacity,transform] ease-out",
          meltingCss && "scale-105 opacity-0 blur-xl"
        )}
        style={{
          fontSize: "clamp(2.5rem, 11vw, 7rem)",
          letterSpacing: "0.2em",
          marginRight: "-0.2em",
          transitionDuration: `${MELT_DURATION_MS}ms`,
        }}
      >
        {CHARS.map((ch, i) => (
          <span
            key={i}
            aria-hidden
            className="inline-block transition-[opacity,filter,transform] ease-out"
            style={{
              opacity: charsOn[i] ? 1 : 0,
              filter: charsOn[i] ? "blur(0px)" : "blur(10px)",
              transform: meltingCss
                ? `translateX(${(i - 2) * 18}px)`
                : charsOn[i]
                  ? "translateY(0)"
                  : "translateY(6px)",
              transitionDuration: meltingCss
                ? `${MELT_DURATION_MS}ms`
                : `${WORDMARK_SETTLE * 1000}ms`,
            }}
          >
            {ch}
          </span>
        ))}
      </span>

      <button
        type="button"
        onClick={skipToMelt}
        aria-hidden={!showSkipHint}
        tabIndex={showSkipHint ? 0 : -1}
        className={cn(
          "pointer-events-auto absolute bottom-8 z-10 rounded-chip border border-line/70 px-4 py-1.5",
          "font-sans text-xs uppercase tracking-[0.14em] text-text-lo",
          "transition-[opacity,color,border-color] duration-hover",
          "hover:border-line hover:text-text-hi",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice",
          showSkipHint && !meltingCss ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        Skip
      </button>
    </div>
  );
}

/** Top edge Lightfield window strip (height via --edge-strip-h). */
export function EdgeStrip() {
  return (
    <LfWindow className="edge-strip lf-window sticky top-0 z-50 shrink-0" aria-hidden />
  );
}
