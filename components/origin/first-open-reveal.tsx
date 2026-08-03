"use client";

import * as React from "react";
import {
  ORIGIN_ARRIVAL_KEY,
  SUPPRESS_INTRO_KEY,
} from "@/lib/intro";
import { setLightfieldPaused } from "@/lib/lightfield";

/**
 * The seam between ORIGIN and the product.
 *
 * The app mounts behind an opaque pre-paint floor. A short-lived shader sends
 * pixel-stepped spectral traces horizontally across it: slow at first, then
 * rapidly accelerating before the traces and floor dissolve together. The
 * pre-paint guard overlaps the mounted overlay, so the dashboard cannot flash
 * before the transition begins.
 */

export const FIRST_OPEN_FLAG = ORIGIN_ARRIVAL_KEY;
/** Suppresses the daily boot intro so two introductions never stack up. */
export const SUPPRESS_INTRO_FLAG = SUPPRESS_INTRO_KEY;

const ARRIVAL_MS = 2800;
const DPR_CAP = 1.5;
const MAX_INTERNAL_PIXELS = 1280 * 720;

const FALLBACK_LINES = [
  { top: 10, width: 176, delay: 140, tone: "ice" },
  { top: 18, width: 214, delay: 20, tone: "white" },
  { top: 27, width: 188, delay: 310, tone: "amber" },
  { top: 36, width: 224, delay: 90, tone: "ice" },
  { top: 45, width: 196, delay: 250, tone: "white" },
  { top: 54, width: 218, delay: 0, tone: "amber" },
  { top: 63, width: 182, delay: 360, tone: "ice" },
  { top: 72, width: 228, delay: 120, tone: "white" },
  { top: 81, width: 192, delay: 280, tone: "amber" },
  { top: 90, width: 210, delay: 60, tone: "ice" },
] as const;

const VERTEX_SHADER = `
  void main() {
    gl_Position = vec4(position, 1.0);
  }
`;

/**
 * Adapted from the supplied mosaic/ring shader's visual language. Instead of
 * concentric radii, finite horizontal traces sweep left-to-right with small
 * RGB offsets and quantized edges. Motion is deliberately ease-in: a quiet
 * crawl becomes a fast final pass.
 */
const FRAGMENT_SHADER = `
  precision highp float;

  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uProgress;
  uniform vec3 uIce;
  uniform vec3 uAmber;

  float hash(float n) {
    return fract(sin(n) * 43758.5453123);
  }

  float traceBand(
    vec2 p,
    float y,
    float head,
    float trail,
    float thickness,
    float seed
  ) {
    float cell = floor((p.x + 4.0) * 74.0);
    float stair = (hash(cell + seed * 91.7) - 0.5) * 0.013;
    float distanceToLine = abs(p.y - y - stair);
    float core = exp(-distanceToLine / thickness);
    float glow = 0.24 * exp(-distanceToLine / (thickness * 6.5));

    float tail = head - trail;
    float windowIn = smoothstep(tail - 0.16, tail + 0.02, p.x);
    float windowOut = 1.0 - smoothstep(head - 0.015, head + 0.035, p.x);
    float broken = 0.78 + 0.22 * step(0.22, hash(cell * 0.37 + seed * 17.0));
    return (core + glow) * windowIn * windowOut * broken;
  }

  void main() {
    float shortSide = min(uResolution.x, uResolution.y);
    vec2 p = (gl_FragCoord.xy * 2.0 - uResolution.xy) / shortSide;
    float aspect = uResolution.x / shortSide;

    // Mosaic the field like the reference, with finer horizontal resolution
    // so the streaks retain their direction while their edges visibly step.
    p.x = floor(p.x * 108.0) / 108.0;
    p.y = floor(p.y * 176.0) / 176.0;

    float travelProgress = clamp(uProgress / 0.80, 0.0, 1.0);
    float travelSquared = travelProgress * travelProgress;
    float accelerated = 0.06 * travelProgress
      + 0.94 * travelSquared * travelSquared;
    float baseHead = mix(-aspect + 0.12, aspect + 0.72, accelerated);

    vec3 color = vec3(0.0);
    for (int i = 0; i < 11; i++) {
      float fi = float(i);
      float seed = fi + 1.0;
      float y = -0.84 + fi * 0.168 + sin(fi * 2.17) * 0.021;
      float lag = hash(seed * 4.13) * 0.48;
      float head = baseHead - lag;
      // Longer than the viewport: after a trace arrives it keeps stretching
      // behind its head, building the continuous "light speed" perspective.
      float trail = aspect * 3.1 + hash(seed * 8.71) * 0.42;
      float pulse = 0.82 + 0.18 * sin(uTime * 3.2 + fi * 1.7);

      float cool = traceBand(p, y + 0.007, head + 0.025, trail, 0.0032, seed);
      float white = traceBand(p, y, head, trail, 0.0022, seed + 7.0);
      float warm = traceBand(p, y - 0.007, head - 0.028, trail, 0.0034, seed + 13.0);

      color += uIce * cool * 0.86 * pulse;
      color += vec3(1.0, 0.985, 0.95) * white * 0.9 * pulse;
      color += uAmber * warm * 0.66 * pulse;
    }

    // The traces disappear before the overlay is removed; this is the moment
    // the dashboard resolves underneath rather than cutting in afterward.
    float fade = 1.0 - smoothstep(0.73, 0.98, uProgress);
    color = (vec3(1.0) - exp(-color * 1.18)) * fade;
    float alpha = clamp(max(max(color.r, color.g), color.b) * 1.7, 0.0, 1.0);
    gl_FragColor = vec4(color, alpha);
  }
`;

export function markFirstOpenPending() {
  try {
    sessionStorage.setItem(FIRST_OPEN_FLAG, "1");
    sessionStorage.setItem(SUPPRESS_INTRO_FLAG, "1");
    document.documentElement.classList.add("origin-arrival-pending");
  } catch {
    /* private mode — the reveal is a nicety, not a requirement */
  }
}

export function consumeFirstOpenFlag(): boolean {
  try {
    if (sessionStorage.getItem(FIRST_OPEN_FLAG) !== "1") return false;
    sessionStorage.removeItem(FIRST_OPEN_FLAG);
    return true;
  } catch {
    return false;
  }
}

export function isBootIntroSuppressed(): boolean {
  try {
    return sessionStorage.getItem(SUPPRESS_INTRO_FLAG) === "1";
  } catch {
    return false;
  }
}

export function clearBootIntroSuppression() {
  try {
    sessionStorage.removeItem(SUPPRESS_INTRO_FLAG);
  } catch {
    /* nothing to clear */
  }
}

/** Mounted by the authenticated shell; idle in every non-ORIGIN session. */
export function FirstOpenReveal() {
  const [phase, setPhase] = React.useState<"idle" | "running" | "done">("idle");
  const [shaderReady, setShaderReady] = React.useState(false);
  const claimedRef = React.useRef<boolean | null>(null);
  const shaderHostRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    // Keep the claim in a ref so React Strict Mode can safely restart this
    // effect without consuming the one-shot session flag twice.
    if (claimedRef.current === null) {
      claimedRef.current = consumeFirstOpenFlag();
    }
    if (!claimedRef.current) {
      document.documentElement.classList.remove("origin-arrival-pending");
      setPhase("done");
      return;
    }

    setPhase("running");

    // Keep the class-backed pre-paint cover until the mounted overlay has
    // reached a painted frame. Removing it earlier causes the dashboard flash.
    let innerRaf = 0;
    const coverRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(() => {
        document.documentElement.classList.remove("origin-arrival-pending");
      });
    });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const toDone = window.setTimeout(() => {
      document.documentElement.classList.remove("origin-arrival-pending");
      setPhase("done");
    }, reduced ? 180 : ARRIVAL_MS);

    return () => {
      cancelAnimationFrame(coverRaf);
      cancelAnimationFrame(innerRaf);
      clearTimeout(toDone);
    };
  }, []);

  // The root lightfield is invisible during the handoff. Pausing it leaves the
  // GPU to the short-lived transition shader, then resumes it for the app.
  React.useEffect(() => {
    const running = phase === "running";
    setLightfieldPaused(running);
    return () => {
      if (running) setLightfieldPaused(false);
    };
  }, [phase]);

  React.useEffect(() => {
    if (phase !== "running") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const host = shaderHostRef.current;
    if (!host) return;

    let cancelled = false;
    let animationId = 0;
    let renderer: import("three").WebGLRenderer | null = null;
    let material: import("three").ShaderMaterial | null = null;
    let geometry: import("three").BufferGeometry | null = null;
    let onResize: (() => void) | null = null;

    void (async () => {
      const THREE = await import("three");
      if (cancelled || !shaderHostRef.current) return;

      try {
        renderer = new THREE.WebGLRenderer({
          antialias: false,
          alpha: true,
          premultipliedAlpha: true,
          powerPreference: "low-power",
        });
      } catch {
        return; // The CSS trace fallback remains visible.
      }
      if (!renderer.getContext()) {
        renderer.dispose();
        renderer = null;
        return;
      }

      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const scene = new THREE.Scene();
      geometry = new THREE.PlaneGeometry(2, 2);

      const rootStyle = getComputedStyle(document.documentElement);
      const ice = rootStyle.getPropertyValue("--ice").trim() || "#7fb4ff";
      const amber = rootStyle.getPropertyValue("--amber").trim() || "#ffb56b";
      const uniforms = {
        uResolution: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uIce: { value: new THREE.Color(ice) },
        uAmber: { value: new THREE.Color(amber) },
      };

      material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      scene.add(new THREE.Mesh(geometry, material));

      const canvas = renderer.domElement;
      canvas.style.display = "block";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      host.replaceChildren(canvas);

      onResize = () => {
        if (!renderer) return;
        const cssWidth = Math.max(1, window.innerWidth);
        const cssHeight = Math.max(1, window.innerHeight);
        const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
        let width = Math.floor(cssWidth * dpr);
        let height = Math.floor(cssHeight * dpr);
        const pixels = width * height;
        if (pixels > MAX_INTERNAL_PIXELS) {
          const scale = Math.sqrt(MAX_INTERNAL_PIXELS / pixels);
          width = Math.max(1, Math.floor(width * scale));
          height = Math.max(1, Math.floor(height * scale));
        }
        renderer.setSize(width, height, false);
        uniforms.uResolution.value.set(width, height);
      };
      onResize();
      window.addEventListener("resize", onResize);

      renderer.compile(scene, camera);
      setShaderReady(true);

      const startedAt = performance.now();
      const draw = (now: number) => {
        if (!renderer || cancelled) return;
        const elapsed = now - startedAt;
        uniforms.uTime.value = elapsed / 1000;
        uniforms.uProgress.value = Math.min(1, elapsed / ARRIVAL_MS);
        renderer.render(scene, camera);
        if (elapsed < ARRIVAL_MS) {
          animationId = requestAnimationFrame(draw);
        }
      };
      animationId = requestAnimationFrame(draw);
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationId);
      if (onResize) window.removeEventListener("resize", onResize);
      geometry?.dispose();
      material?.dispose();
      if (renderer) {
        renderer.dispose();
        if (renderer.domElement.parentNode === host) {
          host.removeChild(renderer.domElement);
        }
      }
    };
  }, [phase]);

  if (phase === "done" || phase === "idle") return null;

  return (
    <div
      aria-hidden
      className="origin-first-open pointer-events-none fixed inset-0 z-[400] overflow-hidden bg-bg-0"
    >
      <div className="origin-first-open__wake absolute inset-0" />
      <div
        className={`origin-first-open__fallback absolute inset-0 ${
          shaderReady ? "opacity-0" : "opacity-100"
        }`}
      >
        {FALLBACK_LINES.map((line, index) => (
          <span
            key={index}
            className={`origin-first-open__fallback-line origin-first-open__fallback-line--${line.tone}`}
            style={{
              top: `${line.top}%`,
              width: `${line.width}vw`,
              animationDelay: `${line.delay}ms`,
            }}
          />
        ))}
      </div>
      <div
        ref={shaderHostRef}
        className={`origin-first-open__shader absolute inset-0 transition-opacity duration-150 ${
          shaderReady ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
