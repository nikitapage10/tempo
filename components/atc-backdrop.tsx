"use client";

/**
 * ATC backdrop — a self-contained WebGL2 canvas that fills the app's content
 * area (everything but the sidebar), fixed so it stays put while the page
 * scrolls.
 *
 * Deliberately separate from components/lightfield.tsx: that one owns the
 * single app-wide Spectra context that pages open windows onto. This is a
 * local surface mounted only by the page that asks for it, and it takes its
 * own (second) WebGL context for as long as that page is open. Unmounting
 * disposes the context explicitly rather than waiting for the GC, so
 * navigating around the app can't accumulate contexts and trip the browser's
 * per-tab limit.
 *
 * Falls back to the still `.spectra-still` gradient — no context taken at all
 * — without WebGL2, under reduced motion, under the lightfield kill switch,
 * or if the program fails to build.
 */

import * as React from "react";
import { ATC_FRAGMENT_SHADER, ATC_VERTEX_SHADER } from "@/lib/atc-shader-glsl";
import { isLightfieldKillSwitch, prefersReducedMotion } from "@/lib/lightfield";
import { cn } from "@/lib/utils";

/** Retina is enough; past 2 the fill cost doubles for no visible gain. */
const DPR_CAP = 2;

/**
 * …and a DPR cap alone is not enough here. The march runs 50 iterations per
 * pixel, so on a large retina display a viewport-filling canvas is millions
 * of pixels × 50, every frame, forever. Renders at most this many pixels and
 * lets the browser scale the result up — invisible on a soft out-of-focus
 * background, and the difference between "ambient" and "laptop fan".
 */
const MAX_INTERNAL_PIXELS = 1600 * 900;

function warn(message: string) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[atc-backdrop] ${message}`);
  }
}

function compile(
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    warn(`shader compile failed: ${gl.getShaderInfoLog(shader)}`);
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function AtcBackdrop({ className }: { className?: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  // Swaps the whole thing for the still gradient: no WebGL2, reduced motion,
  // the kill switch, or a context lost mid-session.
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    if (isLightfieldKillSwitch() || prefersReducedMotion()) {
      warn("disabled by kill switch or reduced-motion preference");
      setFailed(true);
      return;
    }

    const container = containerRef.current;
    if (!container) {
      warn("container ref was empty");
      return;
    }

    // The canvas is created here rather than rendered by React, matching
    // components/lightfield.tsx. Cleanup calls loseContext(), and a canvas
    // whose context has been lost hands the same dead context back to the
    // next getContext() — so under StrictMode's mount/unmount/mount every
    // shader compile on the second run would fail. A fresh element per effect
    // run has no such history.
    const canvas = document.createElement("canvas");
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.opacity = "0";
    canvas.style.transition = "opacity 500ms ease";
    container.replaceChildren(canvas);

    const gl = canvas.getContext("webgl2", {
      premultipliedAlpha: false,
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    });

    if (!gl) {
      warn("WebGL2 not available");
      setFailed(true);
      return;
    }

    const vs = compile(gl, gl.VERTEX_SHADER, ATC_VERTEX_SHADER);
    const fs = compile(gl, gl.FRAGMENT_SHADER, ATC_FRAGMENT_SHADER);
    const program = vs && fs ? gl.createProgram() : null;
    if (!vs || !fs || !program) {
      setFailed(true);
      return;
    }

    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      warn(`program link failed: ${gl.getProgramInfoLog(program)}`);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      setFailed(true);
      return;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, "u_res");
    const uTime = gl.getUniformLocation(program, "u_time");

    let width = 0;
    let height = 0;

    const resize = () => {
      const cssW = canvas.clientWidth || window.innerWidth;
      const cssH = canvas.clientHeight || window.innerHeight;
      const dpr = Math.max(1, Math.min(DPR_CAP, window.devicePixelRatio || 1));
      // Shrink both axes by the same factor so the aspect ratio — which the
      // shader reads through u_res — is never distorted.
      const scale = Math.min(
        1,
        Math.sqrt(MAX_INTERNAL_PIXELS / Math.max(1, cssW * dpr * cssH * dpr))
      );
      const w = Math.max(1, Math.floor(cssW * dpr * scale));
      const h = Math.max(1, Math.floor(cssH * dpr * scale));
      if (w === width && h === height) return;
      width = w;
      height = h;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
    };

    // Elapsed time accumulates only while visible, so a tab left open for an
    // hour resumes where it stopped instead of jumping a huge delta.
    let elapsed = 0;
    let last = performance.now();
    let frame: number | null = null;

    const render = () => {
      resize();
      gl.uniform1f(uTime, elapsed);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      // Fade in only once there is a real frame to fade in to.
      canvas.style.opacity = "1";
    };

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      elapsed += (now - last) / 1000;
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
    // A lost context (GPU reset, driver sleep) would otherwise leave a frozen
    // last frame on screen; fall back to the still gradient instead.
    const onLost = (e: Event) => {
      e.preventDefault();
      stop();
      setFailed(true);
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", onResize, { passive: true });
    canvas.addEventListener("webglcontextlost", onLost);
    // Paint frame zero now rather than waiting on the first animation frame,
    // so a backgrounded tab (where rAF never fires) still shows the field
    // instead of an empty canvas over the still gradient.
    render();
    if (!document.hidden) start();

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("webglcontextlost", onLost);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
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
      {/* Still gradient underneath the canvas — it covers the half-second
          before the first frame, and any gap if the context is later lost. */}
      <div className="spectra-still absolute inset-0" />
      <div ref={containerRef} className="absolute inset-0" />
      {/* Body copy never sits on a raw shader. This holds the whole surface at
          the ≥85%-dark legibility floor the design system asks for, and the
          .glass panels blur the colour and motion that survives it. */}
      <div className="absolute inset-0 bg-bg-0/85" />
    </div>
  );
}
