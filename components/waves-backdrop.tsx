"use client";

/**
 * Waves backdrop — a self-contained WebGL1 canvas that fills its parent.
 *
 * Deliberately separate from components/lightfield.tsx: that one owns the
 * single app-wide Spectra context that pages open windows onto. This is a
 * local surface with its own palette, mounted only by the page that asks for
 * it, and it takes its own (second) WebGL context for as long as that page is
 * open. Unmounting disposes the context explicitly rather than waiting for the
 * GC, so navigating around the app can't accumulate contexts and trip the
 * browser's per-tab limit.
 *
 * Falls back to the still `.spectra-still` gradient — no context taken at all
 * — under reduced motion, the lightfield kill switch, or when WebGL or the
 * program fail to come up.
 */

import * as React from "react";
import {
  WAVES_FRAGMENT_SHADER,
  WAVES_RECIPE,
  WAVES_VERTEX_SHADER,
} from "@/lib/waves-shader-glsl";
import { isLightfieldKillSwitch, prefersReducedMotion } from "@/lib/lightfield";
import { cn } from "@/lib/utils";

/** Retina is enough; past 2 the fill cost doubles for no visible gain. */
const DPR_CAP = 2;

/** Dev-only — a silent fallback is right in production, but not while editing
 *  the shader, where a one-character typo would just look like "no WebGL". */
function warn(message: string) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[waves-backdrop] ${message}`);
  }
}

function compile(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    warn(
      `shader compile failed (lost=${gl.isContextLost()}, len=${source.length}): ${gl.getShaderInfoLog(shader)}`
    );
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function WavesBackdrop({ className }: { className?: string }) {
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

    const gl =
      (canvas.getContext("webgl", {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: "low-power",
      }) as WebGLRenderingContext | null) ??
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);

    if (!gl) {
      warn("no WebGL context available");
      setFailed(true);
      return;
    }

    const vs = compile(gl, gl.VERTEX_SHADER, WAVES_VERTEX_SHADER);
    const fs = compile(gl, gl.FRAGMENT_SHADER, WAVES_FRAGMENT_SHADER);
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

    // One fullscreen triangle, not a quad: no diagonal seam, one fewer vertex,
    // and the clipped corners cost nothing.
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );
    const posLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const loc = (name: string) => gl.getUniformLocation(program, name);
    const uColors = loc("u_colors[0]");
    const uScene = loc("u_scene");
    const uShape = loc("u_shape");
    const uSurface = loc("u_surface");
    const uFinish = loc("u_finish");
    const uTransform = loc("u_transform");
    const uSpace = loc("u_space");
    const uCursor = loc("u_cursor");

    // Eight slots, four in use; u_colorCount tells the shader where to stop.
    const colors = new Float32Array(8 * 3);
    WAVES_RECIPE.colors.forEach((c, i) => colors.set(c, i * 3));
    gl.uniform3fv(uColors, colors);
    gl.uniform4fv(uShape, WAVES_RECIPE.shape as unknown as number[]);
    gl.uniform4fv(uSurface, WAVES_RECIPE.surface as unknown as number[]);
    gl.uniform4fv(uFinish, WAVES_RECIPE.finish as unknown as number[]);
    gl.uniform4fv(uTransform, WAVES_RECIPE.transform as unknown as number[]);
    // Cursor interaction is off, so the pointer slots stay at the origin.
    gl.uniform4f(uSpace, WAVES_RECIPE.offset[0], WAVES_RECIPE.offset[1], 0, 0);
    gl.uniform4fv(uCursor, WAVES_RECIPE.cursor as unknown as number[]);

    let width = 0;
    let height = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (w === width && h === height) return;
      width = w;
      height = h;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    };

    // Elapsed time accumulates only while visible, so a tab left open for an
    // hour resumes where it stopped instead of jumping a huge delta.
    let elapsed = 0;
    let last = performance.now();
    let frame: number | null = null;

    const render = () => {
      resize();
      gl.uniform4f(
        uScene,
        width,
        height,
        elapsed * WAVES_RECIPE.timeScale,
        WAVES_RECIPE.colors.length
      );
      gl.drawArrays(gl.TRIANGLES, 0, 3);
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
    // A lost context (GPU reset, driver sleep) would otherwise leave a frozen
    // last frame on screen; fall back to the still gradient instead.
    const onLost = (e: Event) => {
      e.preventDefault();
      stop();
      setFailed(true);
    };

    document.addEventListener("visibilitychange", onVisibility);
    canvas.addEventListener("webglcontextlost", onLost);
    // Paint frame zero now rather than waiting on the first animation frame,
    // so a backgrounded tab (where rAF never fires) still shows the field
    // instead of an empty canvas over the still gradient.
    render();
    if (!document.hidden) start();

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
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
      {/* Body copy never sits on a raw shader. The palette runs up to a light
          sand at the top of its ramp, so the panels' own blur is not enough on
          its own — this holds the whole surface at the ≥85%-dark legibility
          floor the design system asks for, and the .glass panels blur the
          colour and motion that survives it. */}
      <div className="absolute inset-0 bg-bg-0/85" />
    </div>
  );
}
