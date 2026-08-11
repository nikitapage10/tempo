"use client";

/**
 * Shader-animation backdrop — concentric interference rings, rendered with
 * three.js into this element.
 *
 * Deliberately separate from components/lightfield.tsx: that one owns the
 * single app-wide Spectra context that pages open windows onto. This is a
 * local surface mounted only by the page that asks for it, and it takes its
 * own (second) WebGL context for as long as that page is open. Unmounting
 * disposes renderer, geometry, material and context explicitly rather than
 * waiting for the GC, so navigating around the app can't accumulate contexts
 * and trip the browser's per-tab limit.
 *
 * three is imported dynamically, matching components/lightfield.tsx, so it
 * stays out of the initial bundle for every page that never mounts this.
 *
 * Falls back to the still `.spectra-still` gradient — no context taken at all
 * — under reduced motion, the lightfield kill switch, without WebGL, or if
 * the context is lost mid-session.
 */

import * as React from "react";
import type { WebGLRenderer } from "three";
import { isLightfieldKillSwitch, prefersReducedMotion } from "@/lib/lightfield";
import { cn } from "@/lib/utils";

const VERTEX_SHADER = /* glsl */ `
  void main() {
    gl_Position = vec4( position, 1.0 );
  }
`;

/**
 * Same idea as the original — concentric rings, one per colour channel, the
 * offset between them giving the rainbow edge — but rebuilt so it survives
 * being slowed down. Two things in the original only work at speed:
 *
 *   fract(t - …)  is a sawtooth. Each time t crosses an integer it snaps from
 *   1 back to 0 and every ring jumps at once. At the original ~3 units/sec
 *   that is too fast to read; slowed down it is a visible jolt on a fixed
 *   cycle. Here the phase is fed to sin(), which is continuous and periodic,
 *   so the rings drift forever and nothing ever resets.
 *
 *   lineWidth/abs(…)  is a near-singularity: the bright line is whatever
 *   sub-pixel sliver happens to straddle the zero, with no antialiasing. As
 *   it drifts it crawls between pixels, which is the shimmer that reads as
 *   lag. Here the line is measured in pixels (px) and smoothstepped, so it
 *   holds a constant, properly-filtered width at any resolution or DPR.
 */
const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  uniform vec2 resolution;
  uniform float time;

  #define RING_FREQ 7.0

  // One channel's ring field. chroma offsets this channel's phase, which is
  // what separates the three into coloured fringes.
  float rings(vec2 uv, float t, float chroma, float px) {
    float r = length(uv);

    // A slow breathing warp so the rings read as a living field rather than
    // a machined bullseye. Two incommensurate frequencies, so the pattern
    // never visibly repeats.
    r += 0.05 * sin(uv.x * 1.6 + t * 0.7) + 0.05 * cos(uv.y * 1.8 - t * 0.6);

    float phase = r * RING_FREQ - t + chroma;
    float s = sin(phase);

    // How much phase changes across one pixel — the analytic version of
    // fwidth(), which would need GL_OES_standard_derivatives on WebGL1.
    float aa = RING_FREQ * px;

    // Crisp filtered line, plus a soft halo that falls off smoothly instead
    // of blowing up to infinity at the zero crossing.
    float line = 1.0 - smoothstep(0.0, aa * 2.0, abs(s));
    float glow = 0.10 / (0.10 + abs(s) * 3.0);
    return line * 0.7 + glow * 0.35;
  }

  void main(void) {
    vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
    float px = 2.0 / min(resolution.x, resolution.y);

    vec3 color;
    color.r = rings(uv, time, 0.00, px);
    color.g = rings(uv, time, 0.18, px);
    color.b = rings(uv, time, 0.36, px);

    // Ease the centre off, where the rings crowd together and would alias
    // into a bright knot however well the lines are filtered.
    color *= smoothstep(0.0, 0.45, length(uv));

    gl_FragColor = vec4(color, 1.0);
  }
`;

/**
 * How fast the phase advances, in radians per second.
 *
 * The original advances its time uniform by a fixed 0.05 per *frame*, which
 * is frame-rate dependent — the same page animates twice as fast on a 120Hz
 * display as on a 60Hz one, and stutters whenever a frame is dropped, since
 * the step never accounts for how long the frame actually took. Driving it
 * from elapsed wall-clock seconds makes the speed a real, stable number.
 *
 * One full ring cycle is 2π, so 0.22 rad/s puts a ring roughly every 28
 * seconds: movement you notice only if you look for it.
 */
const TIME_UNITS_PER_SECOND = 0.22;

/** Retina is enough; past 2 the fill cost doubles for no visible gain. */
const DPR_CAP = 2;

function warn(message: string) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[shader-animation] ${message}`);
  }
}

export function ShaderAnimationBackdrop({ className }: { className?: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  // Swaps the whole thing for the still gradient: no WebGL, reduced motion,
  // the kill switch, or a context lost mid-session.
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    if (isLightfieldKillSwitch() || prefersReducedMotion()) {
      warn("disabled by kill switch or reduced-motion preference");
      setFailed(true);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    void (async () => {
      const THREE = await import("three");
      if (cancelled || !containerRef.current) return;

      let renderer: WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({
          // MSAA does nothing for a fullscreen quad — there are no geometry
          // edges to sample, only shader output — while still costing the
          // memory and bandwidth of a multisampled buffer. The rings are
          // antialiased analytically in the shader instead.
          antialias: false,
          alpha: false,
          powerPreference: "low-power",
        });
      } catch {
        warn("could not create a WebGL renderer");
        setFailed(true);
        return;
      }

      const camera = new THREE.Camera();
      camera.position.z = 1;

      const scene = new THREE.Scene();
      const geometry = new THREE.PlaneGeometry(2, 2);
      const uniforms = {
        time: { value: 1.0 },
        resolution: { value: new THREE.Vector2() },
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
      canvas.style.opacity = "0";
      canvas.style.transition = "opacity 500ms ease";
      // replaceChildren, not appendChild: under StrictMode's mount/unmount/
      // mount this effect runs twice, and appending would stack two canvases.
      container.replaceChildren(canvas);

      // The original passes window.devicePixelRatio straight through, which
      // on a 3x phone renders nine times the pixels of a 1x display.
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP));

      let sizedW = 0;
      let sizedH = 0;

      const resize = () => {
        const width = container.clientWidth;
        const height = container.clientHeight;
        if (width === 0 || height === 0) return;
        // Only when it actually changed. The original calls setSize() from
        // the animation loop, so every frame reallocated the drawing buffer
        // and re-read layout — a per-frame stall for a value that changes
        // when the window resizes and never otherwise.
        if (width === sizedW && height === sizedH) return;
        sizedW = width;
        sizedH = height;
        renderer.setSize(width, height, false);
        uniforms.resolution.value.x = canvas.width;
        uniforms.resolution.value.y = canvas.height;
      };

      // Elapsed time accumulates only while visible, so a tab left open for
      // an hour resumes where it stopped instead of jumping a huge delta.
      let elapsed = 1.0;
      let last = performance.now();
      let frame: number | null = null;

      const render = () => {
        resize();
        uniforms.time.value = elapsed;
        renderer.render(scene, camera);
        // Fade in only once there is a real frame to fade in to.
        canvas.style.opacity = "1";
      };

      const draw = (now: number) => {
        frame = requestAnimationFrame(draw);
        elapsed += ((now - last) / 1000) * TIME_UNITS_PER_SECOND;
        last = now;
        render();
      };

      const start = () => {
        if (frame !== null) return;
        last = performance.now();
        frame = requestAnimationFrame(draw);
      };
      const stop = () => {
        if (frame === null) return;
        cancelAnimationFrame(frame);
        frame = null;
      };

      const onVisibility = () => (document.hidden ? stop() : start());
      const onResize = () => render();
      const onLost = (e: Event) => {
        e.preventDefault();
        stop();
        setFailed(true);
      };

      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("resize", onResize, { passive: true });
      canvas.addEventListener("webglcontextlost", onLost);
      // Paint frame zero now rather than waiting on the first animation
      // frame, so a backgrounded tab (where rAF never fires) still shows the
      // field instead of an empty canvas over the still gradient.
      render();
      if (!document.hidden) start();

      cleanup = () => {
        stop();
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("resize", onResize);
        canvas.removeEventListener("webglcontextlost", onLost);
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        canvas.remove();
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  if (failed) {
    return (
      <div
        className={cn("spectra-still pointer-events-none", className)}
        aria-hidden
      />
    );
  }

  return (
    <div className={cn("pointer-events-none overflow-hidden", className)} aria-hidden>
      {/* Still gradient underneath the canvas — it covers the moment before
          the first frame, and any gap if the context is later lost. */}
      <div className="spectra-still absolute inset-0" />
      <div ref={containerRef} className="absolute inset-0" />
      {/* Body copy never sits on a raw shader. This holds the whole surface at
          the ≥85%-dark legibility floor the design system asks for, and the
          .glass panels blur the colour and motion that survives it. */}
      <div className="absolute inset-0 bg-bg-0/85" />
    </div>
  );
}
