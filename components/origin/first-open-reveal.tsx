"use client";

import * as React from "react";
import {
  ORIGIN_ARRIVAL_KEY,
  SUPPRESS_INTRO_KEY,
} from "@/lib/intro";
import { setLightfieldPaused } from "@/lib/lightfield";
import { ORIGIN_MEDIA } from "@/lib/origin/media";

const usePrePaintEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

/**
 * The seam between ORIGIN and the product.
 *
 * The final ORIGIN frame is held above the mounting app. The supplied mosaic
 * shader is turned ninety degrees and travels with a left-to-right clipping
 * edge: dashboard behind it on the left, the held film frame on the right.
 * Both the edge and the light begin offscreen, then accelerate together.
 */

export const FIRST_OPEN_FLAG = ORIGIN_ARRIVAL_KEY;
/** Suppresses the daily boot intro so two introductions never stack up. */
export const SUPPRESS_INTRO_FLAG = SUPPRESS_INTRO_KEY;

const ARRIVAL_MS = 2800;
const DPR_CAP = 1.5;
const MAX_INTERNAL_PIXELS = 1280 * 720;
const FIRST_OPEN_START_EVENT = "tempo:origin-arrival-start";
const LAST_FRAME_SRC = ORIGIN_MEDIA.scroll06.finalPoster;

const FALLBACK_LINES = [
  { left: -18, delay: 120, tone: "ice" },
  { left: -15, delay: 20, tone: "white" },
  { left: -12, delay: 260, tone: "amber" },
  { left: -9, delay: 70, tone: "ice" },
  { left: -6, delay: 190, tone: "white" },
] as const;

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
    float t = uTime * 0.06 + random(uv.y) * 0.4;
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

export function markFirstOpenPending(): Promise<void> {
  try {
    sessionStorage.setItem(FIRST_OPEN_FLAG, "1");
    sessionStorage.setItem(SUPPRESS_INTRO_FLAG, "1");
  } catch {
    /* private mode — the reveal is a nicety, not a requirement */
  }
  // Begin over the final ORIGIN frame and stay mounted through navigation.
  void import("three").catch(() => {});
  window.dispatchEvent(new Event(FIRST_OPEN_START_EVENT));
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
  const [phase, setPhase] = React.useState<"idle" | "running" | "done">("idle");
  const [shaderReady, setShaderReady] = React.useState(false);
  const claimedRef = React.useRef<boolean | null>(null);
  const shaderHostRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const start = () => {
      consumeFirstOpenFlag();
      claimedRef.current = true;
      setShaderReady(false);
      setPhase("running");
    };
    window.addEventListener(FIRST_OPEN_START_EVENT, start);
    return () => window.removeEventListener(FIRST_OPEN_START_EVENT, start);
  }, []);

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

      const startedAt = performance.now();
      const draw = (now: number) => {
        if (!renderer || cancelled) return;
        const elapsed = now - startedAt;
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
      aria-hidden
      className="origin-first-open pointer-events-none fixed inset-0 z-[400] overflow-hidden"
    >
      <div
        className="origin-first-open__last-frame absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${LAST_FRAME_SRC})` }}
      />
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
