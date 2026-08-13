"use client";

import * as React from "react";
import type {
  OrthographicCamera,
  Scene,
  ShaderMaterial,
  VideoTexture,
  WebGLRenderer,
} from "three";
import { setIntroActive, setLightfieldPaused } from "@/lib/lightfield";
import { FRAGMENT_SHADER, VERTEX_SHADER } from "@/lib/intro-shader-glsl";
import {
  INTRO_DAY_KEY,
  INTRO_POSTER,
  INTRO_SOURCES,
  clearIntroPending,
  introDayKey,
  introWillPlay,
} from "@/lib/intro";
import {
  TEMPO_THEME_SRC,
  TEMPO_THEME_VOLUME,
  startTempoThemeBed,
  stopTempoThemeBed,
} from "@/lib/audio/tempo-theme-bed";
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
/** Cross-fade video → canvas. Both show the same frame, so this only has to
 *  cover a possible one-frame offset. */
const CANVAS_SWAP_MS = 80;
const SKIP_HINT_AFTER_MS = 1200;
const SAFETY_TIMEOUT_MS = 12000;
/** Longest we'll sit on black waiting for enough video to play smoothly. */
const BUFFER_WAIT_MS = 2500;
const DPR_CAP = 1.5;
const MAX_INTERNAL_PIXELS = 1280 * 720;

const CHARS = ["T", "E", "M", "P", "O"];

type GL = {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: OrthographicCamera;
  material: ShaderMaterial;
  texture: VideoTexture;
  uniforms: { uMelt: { value: number }; uTexAspect: { value: number } };
};

/**
 * Boot intro: the TEMPO INTRO video plays full-bleed, the wordmark reveals
 * character by character over it, then a GLSL dispersion pass melts the
 * frame apart while the app dissolves up underneath. Once per calendar day;
 * skipped under prefers-reduced-motion.
 *
 * Playback deliberately runs as a plain composited <video>, NOT through the
 * shader: sampling it into a VideoTexture costs a full-frame GPU upload every
 * frame, which is what made playback stutter. The WebGL context is built up
 * front but stays idle until the melt, then draws for ~1.1s and is disposed.
 * The root Lightfield is paused for the same reason — it's invisible behind
 * this overlay and its shader is expensive.
 *
 * The second WebGL context is a deliberate, documented exception to the "one
 * context for the whole app" rule in components/lightfield.tsx.
 */
export function IntroMoment({
  onDone,
}: {
  onDone?: () => void;
}) {
  const [phase, setPhase] = React.useState<
    "checking" | "playing" | "melting" | "done"
  >("checking");
  const [glReady, setGlReady] = React.useState(false);
  const [charsOn, setCharsOn] = React.useState<boolean[]>(() =>
    CHARS.map(() => false)
  );
  const [showSkipHint, setShowSkipHint] = React.useState(false);

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const glRef = React.useRef<GL | null>(null);
  const phaseRef = React.useRef(phase);
  phaseRef.current = phase;
  const gateRanRef = React.useRef(false);
  const cancelBedFadeRef = React.useRef<(() => void) | null>(null);

  /** Stable across playing→melting so the melt context survives the switch. */
  const glActive = phase === "playing" || phase === "melting";

  const finish = React.useCallback(() => {
    setIntroActive(false);
    setLightfieldPaused(false);
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

  // Soft Tempo Theme under the film — same bed as login / Origin.
  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (phase === "playing") {
      cancelBedFadeRef.current?.();
      cancelBedFadeRef.current = startTempoThemeBed(audio, TEMPO_THEME_VOLUME) ?? null;
      return () => {
        cancelBedFadeRef.current?.();
        cancelBedFadeRef.current = null;
      };
    }

    if (phase === "melting" || phase === "done") {
      cancelBedFadeRef.current?.();
      cancelBedFadeRef.current = null;
      void stopTempoThemeBed(audio);
    }
  }, [phase]);

  // Chrome punch-through, and pause the field so the video gets the GPU.
  // Both release on "melting" — the field has to be live again by the time
  // the dissolve reveals it. Written as a plain set (no cleanup-then-reapply)
  // so the phase change can't thrash the attribute.
  React.useEffect(() => {
    const active = phase === "playing";
    setIntroActive(active);
    setLightfieldPaused(active);
  }, [phase]);

  React.useEffect(
    () => () => {
      setIntroActive(false);
      setLightfieldPaused(false);
    },
    []
  );

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
    let bufferTimer: number | null = null;
    let started = false;

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

    // Don't start into a stall — the overlay is already opaque black, so
    // waiting here is invisible, whereas playing unbuffered stutters through
    // the ignition. The login-screen preloader usually makes this instant.
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
  }, [phase, finish]);

  // Build the melt context up front, but draw nothing until the melt — a
  // VideoTexture upload per frame is exactly what we're avoiding here.
  // Keyed on a flag that spans playing+melting, so the playing→melting
  // transition doesn't tear down the context the melt is about to use.
  React.useEffect(() => {
    if (!glActive) return;
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video) return;

    let cancelled = false;
    let onResize: (() => void) | null = null;

    void (async () => {
      const THREE = await import("three");
      if (cancelled || !containerRef.current) return;

      let renderer: WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: false,
          alpha: false,
          powerPreference: "low-power",
        });
      } catch {
        return; // CSS melt fallback — glReady stays false.
      }
      if (!renderer.getContext()) {
        renderer.dispose();
        return;
      }

      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const scene = new THREE.Scene();
      const geometry = new THREE.PlaneGeometry(2, 2);

      const texture = new THREE.VideoTexture(video);
      texture.colorSpace = THREE.SRGBColorSpace;

      const uniforms = {
        uTex: { value: texture },
        uMelt: { value: 0 },
        uResolution: { value: new THREE.Vector2() },
        uTexAspect: { value: 16 / 9 },
        uTime: { value: 0 },
      };

      const material = new THREE.ShaderMaterial({
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

      glRef.current = {
        renderer,
        scene,
        camera,
        material,
        texture,
        uniforms,
      };
      // Compile the program now so the melt's first frame isn't a hitch.
      renderer.compile(scene, camera);
      setGlReady(true);
    })();

    return () => {
      cancelled = true;
      if (onResize) window.removeEventListener("resize", onResize);
      const gl = glRef.current;
      if (gl) {
        gl.texture.dispose();
        gl.material.dispose();
        gl.renderer.dispose();
        if (gl.renderer.domElement.parentNode === container) {
          container.removeChild(gl.renderer.domElement);
        }
        glRef.current = null;
      }
    };
  }, [glActive]);

  // Melt: ramp uMelt (or CSS fallback), then finish. Chrome and the field are
  // released by the phase effect above.
  React.useEffect(() => {
    if (phase !== "melting") return;
    // Must drop with the chrome — the pre-paint cover is opaque, so leaving
    // it up would block the app from showing through the dissolve.
    clearIntroPending();

    const gl = glRef.current;
    const video = videoRef.current;
    let videoPaused = false;

    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / MELT_DURATION_MS);
      if (gl) {
        gl.uniforms.uMelt.value = t;
        if (video?.videoWidth && video.videoHeight) {
          gl.uniforms.uTexAspect.value = video.videoWidth / video.videoHeight;
        }
        gl.renderer.render(gl.scene, gl.camera);
        // Freeze after the first draw — the texture now holds the frame we
        // melt, and decoding further would just burn cycles behind it.
        if (!videoPaused && video) {
          video.pause();
          videoPaused = true;
        }
      }
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        finish();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, finish]);

  if (phase === "checking" || phase === "done") return null;

  const melting = phase === "melting";
  const cssMelt = melting && !glReady;

  return (
    <div
      data-lf-intro-layer
      className={cn(
        "fixed inset-0 z-[300] flex items-center justify-center overflow-hidden bg-bg-0",
        "transition-opacity ease-out",
        melting && "opacity-0"
      )}
      style={{
        transitionDuration: `${MELT_DURATION_MS - MELT_FADE_DELAY_MS}ms`,
        transitionDelay: melting ? `${MELT_FADE_DELAY_MS}ms` : "0ms",
      }}
      aria-hidden
      role="presentation"
      onClick={skipToMelt}
    >
      {/* Soft soundtrack — same Tempo Theme as login / Origin. */}
      <audio
        ref={audioRef}
        src={TEMPO_THEME_SRC}
        preload="auto"
        loop
        aria-hidden
      />

      {/* Plain composited playback — no per-frame GPU upload. */}
      <video
        ref={videoRef}
        className={cn(
          "absolute inset-0 h-full w-full object-cover",
          cssMelt && "scale-125 opacity-0 blur-2xl transition-[filter,opacity,transform] ease-out"
        )}
        style={cssMelt ? { transitionDuration: `${MELT_DURATION_MS}ms` } : undefined}
        muted
        playsInline
        preload="auto"
        poster={INTRO_POSTER}
      >
        {INTRO_SOURCES.map((s) => (
          <source key={s.src} src={s.src} type={s.type} />
        ))}
      </video>

      {/* Melt canvas — idle and invisible until the handoff. */}
      <div
        ref={containerRef}
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 h-full w-full transition-opacity ease-linear",
          melting && glReady ? "opacity-100" : "opacity-0"
        )}
        style={{ transitionDuration: `${CANVAS_SWAP_MS}ms` }}
      />

      {/* Grain over the footage, under the wordmark — the type stays crisp. */}
      <div className="intro-grain z-[5]" aria-hidden />

      <span
        aria-label="TEMPO"
        role="img"
        className={cn(
          "relative z-10 inline-flex select-none font-display font-light leading-none text-text-hi/90 transition-[filter,opacity,transform] ease-out",
          melting && "scale-105 opacity-0 blur-xl"
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
              transform: melting
                ? `translateX(${(i - 2) * 18}px)`
                : charsOn[i]
                  ? "translateY(0)"
                  : "translateY(6px)",
              transitionDuration: melting
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
          showSkipHint && !melting ? "opacity-100" : "pointer-events-none opacity-0"
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
