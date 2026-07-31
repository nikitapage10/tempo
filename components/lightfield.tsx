"use client";

/**
 * Root Lightfield — exactly one WebGL context for the whole app.
 * Fixed full-viewport canvas at z-0; chrome sits above on opaque --bg-0.
 */

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type {
  BufferGeometry,
  ShaderMaterial,
  WebGLRenderer,
} from "three";
import {
  FRAGMENT_SHADER,
  LIGHTFIELD_DEFAULTS,
  VERTEX_SHADER,
} from "@/lib/shader-glsl";
import {
  getDebugOverride,
  getLightfieldUniforms,
  isLightfieldKillSwitch,
  isLightfieldPaused,
  prefersReducedMotion,
  setDebugOverride,
  subscribeLightfield,
  tickLightfield,
  type LightfieldUniforms,
} from "@/lib/lightfield";
import { LightfieldWindowsProvider } from "@/components/lf-windows";

const MAX_INTERNAL_PIXELS = 1280 * 720;
const DPR_CAP = 1.5;

function useLightfieldEnabled(): boolean {
  const [enabled, setEnabled] = React.useState(false);

  React.useEffect(() => {
    if (isLightfieldKillSwitch()) {
      setEnabled(false);
      return;
    }
    if (prefersReducedMotion()) {
      setEnabled(false);
      return;
    }
    setEnabled(true);
  }, []);

  return enabled;
}

function LightfieldCanvas() {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let animationId: number | null = null;
    let renderer: WebGLRenderer | null = null;
    let geometry: BufferGeometry | null = null;
    let material: ShaderMaterial | null = null;
    let onResize: (() => void) | null = null;
    let onVisibility: (() => void) | null = null;
    let lastTs = performance.now();

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
        container.classList.add("flare-static");
        return;
      }

      if (!renderer.getContext()) {
        renderer.dispose();
        renderer = null;
        container.classList.add("flare-static");
        return;
      }

      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const scene = new THREE.Scene();
      geometry = new THREE.PlaneGeometry(2, 2);

      const uniforms = {
        time: { value: 1.0 },
        resolution: { value: new THREE.Vector2() },
        uSpeed: { value: LIGHTFIELD_DEFAULTS.uSpeed },
        uIntensity: { value: LIGHTFIELD_DEFAULTS.uIntensity },
        uWarmth: { value: LIGHTFIELD_DEFAULTS.uWarmth },
        uSeed: { value: LIGHTFIELD_DEFAULTS.uSeed },
        uIce: { value: new THREE.Vector3(...LIGHTFIELD_DEFAULTS.uIce) },
        uAmber: { value: new THREE.Vector3(...LIGHTFIELD_DEFAULTS.uAmber) },
        uWhite: { value: new THREE.Vector3(...LIGHTFIELD_DEFAULTS.uWhite) },
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

      let tabVisible = document.visibilityState === "visible";

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
        uniforms.resolution.value.x = w;
        uniforms.resolution.value.y = h;
      };

      const applyUniforms = (u: LightfieldUniforms) => {
        uniforms.uSpeed.value = u.uSpeed;
        uniforms.uIntensity.value = u.uIntensity;
        uniforms.uWarmth.value = u.uWarmth;
        uniforms.uSeed.value = u.uSeed;
        uniforms.uIce.value.set(u.uIce[0], u.uIce[1], u.uIce[2]);
        uniforms.uAmber.value.set(u.uAmber[0], u.uAmber[1], u.uAmber[2]);
        uniforms.uWhite.value.set(u.uWhite[0], u.uWhite[1], u.uWhite[2]);
      };

      applyUniforms(getLightfieldUniforms());

      const animate = (ts: number) => {
        animationId = requestAnimationFrame(animate);
        // Paused while the boot intro covers the field — see setLightfieldPaused.
        if (!tabVisible || !renderer || isLightfieldPaused()) return;
        const dt = Math.min(64, ts - lastTs);
        lastTs = ts;
        // Match original time step at default speed: += 0.05 per frame (~60fps).
        uniforms.time.value += 0.05 * (dt / 16.666);
        applyUniforms(tickLightfield(dt));
        renderer.render(scene, camera);
      };

      onVisibility = () => {
        tabVisible = document.visibilityState === "visible";
        if (tabVisible) lastTs = performance.now();
      };

      onResize();
      window.addEventListener("resize", onResize);
      document.addEventListener("visibilitychange", onVisibility);
      animationId = requestAnimationFrame(animate);
    })();

    return () => {
      cancelled = true;
      if (animationId != null) cancelAnimationFrame(animationId);
      if (onResize) window.removeEventListener("resize", onResize);
      if (onVisibility)
        document.removeEventListener("visibilitychange", onVisibility);
      geometry?.dispose();
      material?.dispose();
      if (renderer) {
        renderer.dispose();
        if (renderer.domElement.parentNode === container) {
          container.removeChild(renderer.domElement);
        }
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-0 z-0 h-full w-full overflow-hidden"
      aria-hidden
    />
  );
}

function DebugPanel() {
  const [open, setOpen] = React.useState(false);
  const [vals, setVals] = React.useState<LightfieldUniforms>({
    ...LIGHTFIELD_DEFAULTS,
  });

  React.useEffect(() => {
    setOpen(true);
    const unsub = subscribeLightfield(() => {
      setVals(getLightfieldUniforms());
    });
    setVals(getLightfieldUniforms());
    return unsub;
  }, []);

  if (!open) return null;

  const override = getDebugOverride();

  const slider = (
    key: "uSpeed" | "uIntensity" | "uWarmth" | "uSeed",
    min: number,
    max: number,
    step: number
  ) => (
    <label key={key} className="flex flex-col gap-1 font-mono text-[10px] text-text-lo">
      <span className="flex justify-between uppercase tracking-[0.08em]">
        <span>{key}</span>
        <span className="text-text-hi">{vals[key].toFixed(4)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={override?.[key] ?? vals[key]}
        onChange={(e) => {
          const v = Number(e.target.value);
          setDebugOverride({ ...(override ?? vals), [key]: v });
          setVals((prev) => ({ ...prev, [key]: v }));
        }}
        className="accent-amber"
      />
    </label>
  );

  return (
    <div className="pointer-events-auto fixed bottom-4 right-4 z-[200] w-64 rounded-card border border-line bg-bg-1/95 p-3 shadow-raise backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-amber">
          lf debug
        </p>
        <button
          type="button"
          className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-lo hover:text-text-hi"
          onClick={() => {
            setDebugOverride(null);
            setVals(getLightfieldUniforms());
          }}
        >
          Reset
        </button>
      </div>
      <div className="flex flex-col gap-3">
        {slider("uSpeed", 0.01, 0.2, 0.001)}
        {slider("uIntensity", 0.0001, 0.003, 0.00005)}
        {slider("uWarmth", -1, 1, 0.01)}
        {slider("uSeed", 0, 10, 0.01)}
      </div>
    </div>
  );
}

function DebugGate() {
  const search = useSearchParams();
  if (search.get("lf") !== "debug") return null;
  return <DebugPanel />;
}

/**
 * Mount once in the root layout. Renders the field canvas (or `.flare-static`)
 * and wraps app chrome so only registered windows show light.
 */
export function LightfieldRoot({ children }: { children: React.ReactNode }) {
  const enabled = useLightfieldEnabled();
  const pathname = usePathname();

  return (
    <>
      {enabled ? (
        <LightfieldCanvas />
      ) : (
        <div
          className="flare-static pointer-events-none fixed inset-0 z-0"
          aria-hidden
        />
      )}
      <LightfieldWindowsProvider>
        <div className="lf-app min-h-screen" data-pathname={pathname}>
          {children}
        </div>
      </LightfieldWindowsProvider>
      <React.Suspense fallback={null}>
        <DebugGate />
      </React.Suspense>
    </>
  );
}
