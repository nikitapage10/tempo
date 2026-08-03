"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import {
  ORIGIN_ARRIVAL_KEY,
  SUPPRESS_INTRO_KEY,
} from "@/lib/intro";
import { setLightfieldPaused } from "@/lib/lightfield";
import { OriginFilmGrain } from "@/components/origin/origin-media-stage";

const usePrePaintEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

/**
 * The seam between ORIGIN and the product.
 *
 * The final ORIGIN frame is held above the mounting app. The supplied mosaic
 * shader is turned ninety degrees and travels with a left-to-right, banded
 * feather mask: dashboard behind it on the left, held film on the right. The
 * mask and the light share one progress clock and accelerate together.
 */

export const FIRST_OPEN_FLAG = ORIGIN_ARRIVAL_KEY;
/** Suppresses the daily boot intro so two introductions never stack up. */
export const SUPPRESS_INTRO_FLAG = SUPPRESS_INTRO_KEY;

const ARRIVAL_MS = 2800;
const DPR_CAP = 1.5;
const MAX_INTERNAL_PIXELS = 1280 * 720;
const REVEAL_BANDS = 32;
const FIRST_OPEN_START_EVENT = "tempo:origin-arrival-start";

const FALLBACK_LINES = [
  { left: -18, delay: 120, tone: "ice" },
  { left: -15, delay: 20, tone: "white" },
  { left: -12, delay: 260, tone: "amber" },
  { left: -9, delay: 70, tone: "ice" },
  { left: -6, delay: 190, tone: "white" },
] as const;

type FirstOpenStartDetail = { frameCanvas: HTMLCanvasElement | null };

function shaderRandom(value: number) {
  const raw = Math.sin(value) * 1e4;
  return raw - Math.floor(raw);
}

/**
 * Builds overlapping row masks whose offsets use the same quantized-y random
 * function as the shader. The generous alpha feather removes any geometric
 * edge while the small row offsets preserve the stepped slider silhouette.
 */
function applyBandedArrivalMask(element: HTMLDivElement) {
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  const shortSide = Math.min(width, height);
  const bandHeight = Math.ceil(height / REVEAL_BANDS) + 2;
  const images: string[] = [];
  const sizes: string[] = [];
  const positions: string[] = [];

  for (let index = 0; index < REVEAL_BANDS; index += 1) {
    // WebGL's y-axis begins at the bottom, so mirror the DOM row centre before
    // applying the shader's exact mosaic quantization and random offset.
    const cssY = ((index + 0.5) / REVEAL_BANDS) * height;
    const glY = height - cssY;
    const uvY = (glY * 2 - height) / shortSide;
    const mosaicY = Math.floor((uvY * 256) / 6) / (256 / 6);
    const offset = (shaderRandom(mosaicY) - 0.5) * 6.5;
    const edge = (extra = 0) =>
      `calc(var(--origin-arrival-front) + ${(offset + extra).toFixed(3)}vw)`;

    images.push(
      `linear-gradient(to right, transparent ${edge(-8)}, rgb(0 0 0 / 0.12) ${edge(-3.5)}, rgb(0 0 0 / 0.7) ${edge(2.5)}, #000 ${edge(8)})`
    );
    sizes.push(`100% ${bandHeight}px`);
    positions.push(`0 ${Math.floor((index / REVEAL_BANDS) * height)}px`);
  }

  const image = images.join(", ");
  const size = sizes.join(", ");
  const position = positions.join(", ");
  element.style.setProperty("mask-image", image);
  element.style.setProperty("-webkit-mask-image", image);
  element.style.setProperty("mask-size", size);
  element.style.setProperty("-webkit-mask-size", size);
  element.style.setProperty("mask-position", position);
  element.style.setProperty("-webkit-mask-position", position);
  element.style.setProperty("mask-repeat", "no-repeat");
  element.style.setProperty("-webkit-mask-repeat", "no-repeat");
}

const VERTEX_SHADER = `
  void main() {
    gl_Position = vec4(position, 1.0);
  }
`;

/**
 * Close port of the supplied shader. Its mosaic scale, random functions, RGB
 * loops, offsets, line width, and reciprocal-distance glow are retained. Only
 * its distance field is rotated into a horizontal travel axis.
 */
const FRAGMENT_SHADER = `
  #define TWO_PI 6.2831853072
  #define PI 3.14159265359

  precision highp float;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uProgress;

  float random(in float x) {
    return fract(sin(x) * 1e4);
  }

  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  void main(void) {
    float shortSide = min(uResolution.x, uResolution.y);
    vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / shortSide;

    // Keep the reference mosaic, but sample fewer rows so the seam breathes.
    vec2 fMosaicScal = vec2(4.0, 6.0);
    vec2 vScreenSize = vec2(256.0, 256.0);
    uv.x = floor(uv.x * vScreenSize.x / fMosaicScal.x)
      / (vScreenSize.x / fMosaicScal.x);
    uv.y = floor(uv.y * vScreenSize.y / fMosaicScal.y)
      / (vScreenSize.y / fMosaicScal.y);

    // The reference uses length(uv), which sends its bands radially. Mapping
    // x into that same 0..1 distance range turns the original equation into
    // long traces whose motion travels horizontally across the view.
    float aspect = uResolution.x / shortSide;
    float horizontalDistance = (uv.x + aspect) / (2.0 * aspect);
    // Keep the reference's stepped slider rows, but constrain their offset to
    // a tight cluster so they read as one moving front instead of loose debris.
    float t = uTime * 0.06 + (random(uv.y) - 0.5) * 0.065;
    float lineWidth = 0.0008;

    vec3 color = vec3(0.0);
    for (int j = 0; j < 3; j++) {
      for (int i = 1; i < 4; i++) {
        color[j] += lineWidth * float(i * i)
          / abs(fract(t - 0.01 * float(j) + float(i) * 0.01)
          - horizontalDistance);
      }
    }

    // The light is a narrow moving seam, not a full-screen plate. Its front
    // begins outside the left edge and accelerates past the right edge.
    float travel = 0.14 * uProgress + 0.86 * uProgress * uProgress * uProgress;
    float front = mix(-0.24, 1.22, travel);
    float seam = 1.0 - smoothstep(0.025, 0.19, abs(horizontalDistance - front));
    color *= seam;
    float alpha = clamp(max(max(color.r, color.g), color.b) * 1.35, 0.0, 1.0);
    gl_FragColor = vec4(color[2], color[1], color[0], alpha);
  }
`;

export function captureOriginFrame(video: HTMLVideoElement | null): HTMLCanvasElement | null {
  if (!video || video.videoWidth < 1 || video.videoHeight < 1) {
    return null;
  }
  try {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.className = "absolute inset-0 h-full w-full object-cover";
    return canvas;
  } catch {
    return null;
  }
}

export function markFirstOpenPending(frameCanvas: HTMLCanvasElement | null): Promise<void> {
  try {
    sessionStorage.setItem(FIRST_OPEN_FLAG, "1");
    sessionStorage.setItem(SUPPRESS_INTRO_FLAG, "1");
  } catch {
    /* private mode — the reveal is a nicety, not a requirement */
  }
  // Begin over the final ORIGIN frame and stay mounted through navigation.
  void import("three").catch(() => {});
  window.dispatchEvent(
    new CustomEvent<FirstOpenStartDetail>(FIRST_OPEN_START_EVENT, {
      detail: { frameCanvas },
    })
  );
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
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

/** Mounted at the root so the same overlay survives ORIGIN -> app navigation. */
export function FirstOpenReveal() {
  const pathname = usePathname();
  const [phase, setPhase] = React.useState<"idle" | "running" | "done">("idle");
  const [shaderReady, setShaderReady] = React.useState(false);
  const [hasHeldFrame, setHasHeldFrame] = React.useState(false);
  const claimedRef = React.useRef<boolean | null>(null);
  const shaderHostRef = React.useRef<HTMLDivElement>(null);
  const transitionRef = React.useRef<HTMLDivElement>(null);
  const heldFrameLayerRef = React.useRef<HTMLDivElement>(null);
  const heldFrameHostRef = React.useRef<HTMLDivElement>(null);
  const heldFrameCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const startedAtRef = React.useRef(0);

  React.useEffect(() => {
    const start = (event: Event) => {
      const detail = (event as CustomEvent<FirstOpenStartDetail>).detail;
      consumeFirstOpenFlag();
      claimedRef.current = true;
      heldFrameCanvasRef.current = detail?.frameCanvas ?? null;
      setHasHeldFrame(Boolean(detail?.frameCanvas));
      setShaderReady(false);
      startedAtRef.current = performance.now();
      setPhase("running");
    };
    window.addEventListener(FIRST_OPEN_START_EVENT, start);
    return () => window.removeEventListener(FIRST_OPEN_START_EVENT, start);
  }, []);

  usePrePaintEffect(() => {
    if (pathname === "/origin" || !hasHeldFrame) return;
    const host = heldFrameHostRef.current;
    const layer = heldFrameLayerRef.current;
    const canvas = heldFrameCanvasRef.current;
    if (host && canvas) host.replaceChildren(canvas);
    if (!layer) return;
    applyBandedArrivalMask(layer);
    const onResize = () => applyBandedArrivalMask(layer);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [hasHeldFrame, pathname]);

  usePrePaintEffect(() => {
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
      consumeFirstOpenFlag();
      claimedRef.current = false;
      setPhase("done");
    }, reduced ? 180 : ARRIVAL_MS);

    return () => {
      cancelAnimationFrame(coverRaf);
      cancelAnimationFrame(innerRaf);
      clearTimeout(toDone);
    };
  }, [phase]);

  // One clock owns the wipe position. The DOM mask reads this custom property,
  // while WebGL derives its front from the same start time below.
  React.useEffect(() => {
    if (phase !== "running") return;
    if (!startedAtRef.current) startedAtRef.current = performance.now();
    let animationId = 0;
    const draw = (now: number) => {
      const progress = Math.min(1, (now - startedAtRef.current) / ARRIVAL_MS);
      const travel = 0.14 * progress + 0.86 * progress ** 3;
      const front = -24 + (122 - -24) * travel;
      transitionRef.current?.style.setProperty(
        "--origin-arrival-front",
        `${front}%`
      );
      if (progress < 1) animationId = requestAnimationFrame(draw);
    };
    animationId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animationId);
  }, [phase]);

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

      const uniforms = {
        uResolution: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 1 },
        uProgress: { value: 0 },
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
      renderer.setClearColor(0x000000, 0);
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
      // Paint the reference's time=1 frame before replacing the CSS fallback.
      renderer.render(scene, camera);
      setShaderReady(true);

      const draw = (now: number) => {
        if (!renderer || cancelled) return;
        const elapsed = now - startedAtRef.current;
        const progress = Math.min(1, elapsed / ARRIVAL_MS);
        const accelerated = 0.08 * progress + 0.92 * progress ** 4;
        // The supplied component advances time by roughly 8.4 over 2.8s at
        // 60fps. Preserve that distance, but put most of it in the final rush.
        uniforms.uTime.value = 1 + 8.4 * accelerated;
        uniforms.uProgress.value = progress;
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
      ref={transitionRef}
      aria-hidden
      className="origin-first-open pointer-events-none fixed inset-0 z-[400] overflow-hidden"
    >
      {pathname !== "/origin" && hasHeldFrame ? (
        <div
          ref={heldFrameLayerRef}
          className="origin-first-open__last-frame absolute inset-0"
        >
          <div className="origin-media-layer">
            <div ref={heldFrameHostRef} className="absolute inset-0" />
            <OriginFilmGrain />
          </div>
        </div>
      ) : null}
      <div
        className={`origin-first-open__fallback absolute inset-0 z-[1] ${
          shaderReady ? "opacity-0" : "opacity-100"
        }`}
      >
        {FALLBACK_LINES.map((line, index) => (
          <span
            key={index}
            className={`origin-first-open__fallback-line origin-first-open__fallback-line--${line.tone}`}
            style={{
              left: `${line.left}%`,
              animationDelay: `${line.delay}ms`,
            }}
          />
        ))}
      </div>
      <div
        ref={shaderHostRef}
        className={`origin-first-open__shader absolute inset-0 z-[1] transition-opacity duration-150 ${
          shaderReady ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
