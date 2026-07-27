"use client";

/**
 * Spectra shader-lines — adapted from reference/shader-lines-original.tsx.
 * Fragment shader GLSL is byte-for-byte identical to the reference.
 *
 * `three` is loaded only in the browser (dynamic import) so Next.js doesn’t
 * try to SSR a WebGL vendor chunk.
 */

import * as React from "react";
import type {
  BufferGeometry,
  ShaderMaterial,
  WebGLRenderer,
} from "three";
import { cn } from "@/lib/utils";

const VERTEX_SHADER = `
  void main() {
    gl_Position = vec4( position, 1.0 );
  }
`;

// KEEP BYTE-FOR-BYTE IDENTICAL to reference/shader-lines-original.tsx
const FRAGMENT_SHADER = `
      #define TWO_PI 6.2831853072
      #define PI 3.14159265359

      precision highp float;
      uniform vec2 resolution;
      uniform float time;
        
      float random (in float x) {
          return fract(sin(x)*1e4);
      }
      float random (vec2 st) {
          return fract(sin(dot(st.xy,
                               vec2(12.9898,78.233)))*
              43758.5453123);
      }
      
      varying vec2 vUv;

      void main(void) {
        vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
        
        vec2 fMosaicScal = vec2(4.0, 2.0);
        vec2 vScreenSize = vec2(256,256);
        uv.x = floor(uv.x * vScreenSize.x / fMosaicScal.x) / (vScreenSize.x / fMosaicScal.x);
        uv.y = floor(uv.y * vScreenSize.y / fMosaicScal.y) / (vScreenSize.y / fMosaicScal.y);       
          
        float t = time*0.06+random(uv.x)*0.4;
        float lineWidth = 0.0008;

        vec3 color = vec3(0.0);
        for(int j = 0; j < 3; j++){
          for(int i=0; i < 5; i++){
            color[j] += lineWidth*float(i*i) / abs(fract(t - 0.01*float(j)+float(i)*0.01)*1.0 - length(uv));        
          }
        }

        gl_FragColor = vec4(color[2],color[1],color[0],1.0);
      }
    `;

export type ShaderLinesProps = {
  className?: string;
  /** Scales the `lineWidth` constant (default 1). */
  intensity?: number;
  /** Scales the time increment per frame (default 1). */
  speed?: number;
};

const STATIC_FALLBACK =
  "linear-gradient(120deg, #0A0A0C 0%, #1a2233 35%, #2a1f14 70%, #0A0A0C 100%)";

function buildFragmentShader(intensity: number): string {
  if (intensity === 1) return FRAGMENT_SHADER;
  const lineWidth = 0.0008 * Math.max(0.05, intensity);
  return FRAGMENT_SHADER.replace(
    "float lineWidth = 0.0008;",
    `float lineWidth = ${lineWidth.toFixed(6)};`
  );
}

export function ShaderLines({
  className,
  intensity = 1,
  speed = 1,
}: ShaderLinesProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [mode, setMode] = React.useState<"pending" | "live" | "static">(
    "pending"
  );

  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setMode("static");
      return;
    }
    setMode("live");
  }, []);

  React.useEffect(() => {
    if (mode !== "live") return;
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let animationId: number | null = null;
    let renderer: WebGLRenderer | null = null;
    let geometry: BufferGeometry | null = null;
    let material: ShaderMaterial | null = null;
    let io: IntersectionObserver | null = null;
    let onResize: (() => void) | null = null;
    let onVisibility: (() => void) | null = null;

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
        setMode("static");
        return;
      }

      if (!renderer.getContext()) {
        renderer.dispose();
        renderer = null;
        setMode("static");
        return;
      }

      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const scene = new THREE.Scene();
      geometry = new THREE.PlaneGeometry(2, 2);

      const uniforms = {
        time: { value: 1.0 },
        resolution: { value: new THREE.Vector2() },
      };

      material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: VERTEX_SHADER,
        fragmentShader: buildFragmentShader(intensity),
      });

      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      container.innerHTML = "";
      container.appendChild(renderer.domElement);

      let visible = true;
      let tabVisible = document.visibilityState === "visible";

      onResize = () => {
        if (!renderer) return;
        const rect = container.getBoundingClientRect();
        const w = Math.max(1, Math.floor(rect.width));
        const h = Math.max(1, Math.floor(rect.height));
        renderer.setSize(w, h, false);
        uniforms.resolution.value.x = renderer.domElement.width;
        uniforms.resolution.value.y = renderer.domElement.height;
      };

      const animate = () => {
        animationId = requestAnimationFrame(animate);
        if (!visible || !tabVisible || !renderer) return;
        uniforms.time.value += 0.05 * speed;
        renderer.render(scene, camera);
      };

      onVisibility = () => {
        tabVisible = document.visibilityState === "visible";
      };

      io = new IntersectionObserver(
        ([entry]) => {
          visible = entry?.isIntersecting ?? false;
        },
        { threshold: 0.01 }
      );
      io.observe(container);

      onResize();
      window.addEventListener("resize", onResize);
      document.addEventListener("visibilitychange", onVisibility);
      animate();
    })();

    return () => {
      cancelled = true;
      if (animationId != null) cancelAnimationFrame(animationId);
      if (onResize) window.removeEventListener("resize", onResize);
      if (onVisibility)
        document.removeEventListener("visibilitychange", onVisibility);
      io?.disconnect();
      geometry?.dispose();
      material?.dispose();
      if (renderer) {
        renderer.dispose();
        if (renderer.domElement.parentNode === container) {
          container.removeChild(renderer.domElement);
        }
      }
    };
  }, [intensity, speed, mode]);

  if (mode === "static" || mode === "pending") {
    return (
      <div
        className={cn("h-full w-full", className)}
        style={{ background: STATIC_FALLBACK }}
        aria-hidden
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "h-full w-full overflow-hidden [&_canvas]:block [&_canvas]:h-full [&_canvas]:w-full",
        className
      )}
      aria-hidden
    />
  );
}
