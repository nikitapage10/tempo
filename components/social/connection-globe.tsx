"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import createGlobe from "cobe";
import { ArtistMark } from "@/components/artists/artist-mark";
import { resolveLocation, scatter } from "@/lib/geo";
import type { LatLon } from "@/lib/geo";
import { cn } from "@/lib/utils";

export type GlobePerson = {
  id: string;
  name: string;
  handle: string | null;
  emblemUrl: string | null;
  paletteId: string | null;
  iceColor: string | null;
  amberColor: string | null;
  location: string | null;
  countryCode: string | null;
  /** Free-text line under the name in the hover card ("Collaborator", "@handle"). */
  detail: string;
  /** Fallback when there's no public profile to link to. */
  personId: string | null;
};

type GlobeMarker = GlobePerson & { coords: LatLon; label: string };

type ConnectionGlobeProps = {
  people: GlobePerson[];
  /** How many people to resolve onto the globe at most. Density culling
   *  (and zoom) decide how many of those actually show at once. */
  max?: number;
  onOpenPerson?: (personId: string) => void;
  className?: string;
  /** Hex accents — defaults to Spectra ice/amber. Pass the active artist's
   *  resolved palette so the globe follows whatever they picked in Settings. */
  accentIce?: string;
  accentAmber?: string;
};

/* --- cobe projection constants -------------------------------------------
 * Read off cobe's own shaders so the DOM pins land exactly on the WebGL
 * globe. The sphere has radius 0.8 in cobe's normalised space (its fragment
 * shader discards outside `dot(b,b) > 0.64`), and the marker vertex shader
 * rotates by phi about Y then theta about X. On a square canvas the NDC
 * mapping is simply `ndc = l.xy * scale`.
 */
const SPHERE_R = 0.8;
/** Where the avatar floats, as a multiple of the sphere radius. */
const PIN_R = 1.02;
const THETA = 0.3;
/** Slow, ambient drift — about one rotation every ~3.5 minutes. */
const BASE_SPEED = 0.0008;
/** Fraction of the (square) canvas kept visible — a bit more than half, so
 *  the lower latitudes still read before the horizon fade takes over. */
const VISIBLE = 0.58;
/** Room above the sphere crest for the atmosphere glow — without this the
 *  halo clips against the container and reads as a flat square top. */
const GLOW_PAD = 52;
const ZOOM_MIN = 1;
const ZOOM_MAX = 2.55;
/** At zoom 1, pins closer than this (degrees) hide behind each other;
 *  zooming in lowers the threshold so clustered cities peel apart.
 *  Tuned so near-neighbors like London / Amsterdam / Berlin can all show
 *  zoomed out (with a little overlap) instead of collapsing to one pin. */
const BASE_SEP_DEG = 2.6;

type Projected = { x: number; y: number; z: number };

/** cobe's `[lat, lon] -> unit vector`, then its phi/theta rotation. */
function project(coords: LatLon, phi: number, theta: number, r: number): Projected {
  const lat = (coords[0] * Math.PI) / 180;
  const lon = (coords[1] * Math.PI) / 180 - Math.PI;
  const cl = Math.cos(lat);
  const ax = -cl * Math.cos(lon) * r;
  const ay = Math.sin(lat) * r;
  const az = cl * Math.sin(lon) * r;

  const e = Math.cos(phi);
  const f = Math.sin(phi);
  const c = Math.cos(theta);
  const d = Math.sin(theta);

  return {
    x: e * ax + f * az,
    y: f * d * ax + c * ay - e * d * az,
    z: -f * c * ax + d * ay + e * c * az,
  };
}

function hexToUnitRgb(hex: string, fallback: [number, number, number]): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function toMarkers(people: GlobePerson[], max: number): GlobeMarker[] {
  const out: GlobeMarker[] = [];
  for (const p of people) {
    const base = resolveLocation(p.location, p.countryCode);
    if (!base) continue;
    out.push({
      ...p,
      coords: scatter(base, p.id),
      label: (p.location ?? "").trim() || "Somewhere out there",
    });
    if (out.length >= max) break;
  }
  return out;
}

/** Rough degree distance with longitude compressed by latitude — good enough
 *  for "are these two pins sitting on top of each other on the globe". */
function approxDegDist(a: LatLon, b: LatLon): number {
  const midLat = (((a[0] + b[0]) / 2) * Math.PI) / 180;
  const dLat = a[0] - b[0];
  const dLon = (a[1] - b[1]) * Math.cos(midLat);
  return Math.hypot(dLat, dLon);
}

/**
 * Greedy density cull. Order is preserved (you first, then follows, …), so
 * earlier pins win contested spots. Separation shrinks as zoom grows, so a
 * crowded Europe only reveals neighbors once you've scrolled in.
 */
function cullDense(markers: GlobeMarker[], zoom: number): GlobeMarker[] {
  const minSep = BASE_SEP_DEG / Math.max(ZOOM_MIN, zoom);
  const shown: GlobeMarker[] = [];
  for (const m of markers) {
    if (shown.every((s) => approxDegDist(s.coords, m.coords) >= minSep)) {
      shown.push(m);
    }
  }
  return shown;
}

function clampZoom(z: number) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

/**
 * A half globe cresting up from the bottom of the Social page, with your
 * connections pinned where they are in the world. Hovering a pin eases the
 * spin down (never a hard stop); clicking opens their profile. Scroll to zoom
 * in — clustered pins (e.g. several people in Europe) stay collapsed until
 * the view is close enough for them to separate.
 *
 * Pins are plain DOM so they can carry avatars, hover cards and links — their
 * positions are written straight to `style` each frame rather than through
 * React state, so a spinning globe doesn't re-render the page.
 */
export function ConnectionGlobe({
  people,
  max = 80,
  onOpenPerson,
  className,
  accentIce = "#7fb4ff",
  accentAmber = "#ffb56b",
}: ConnectionGlobeProps) {
  const router = useRouter();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const pinRefs = React.useRef(new Map<string, HTMLDivElement | null>());

  const [size, setSize] = React.useState(0);
  const [hoverId, setHoverId] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);
  const [reduced, setReduced] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [zoom, setZoom] = React.useState(ZOOM_MIN);

  const allMarkers = React.useMemo(() => toMarkers(people, max), [people, max]);
  const markers = React.useMemo(
    () => cullDense(allMarkers, zoom),
    [allMarkers, zoom]
  );
  const markerRgb = React.useMemo(
    () => hexToUnitRgb(accentIce, [0.498, 0.706, 1]),
    [accentIce]
  );
  const glowRgb = React.useMemo(
    () => hexToUnitRgb(accentAmber, [1, 0.71, 0.42]),
    [accentAmber]
  );
  // 0-255 triples for the fixed atmosphere around the globe.
  const iceCss = markerRgb.map((c) => Math.round(c * 255)).join(" ");
  const amberCss = glowRgb.map((c) => Math.round(c * 255)).join(" ");
  const culled = allMarkers.length > markers.length;

  // Read by the animation loop without restarting it.
  const hoverRef = React.useRef<string | null>(null);
  hoverRef.current = hoverId;
  const visibleRef = React.useRef(true);
  const reducedRef = React.useRef(false);
  reducedRef.current = reduced;
  const markersRef = React.useRef(markers);
  markersRef.current = markers;
  const zoomRef = React.useRef(zoom);
  zoomRef.current = zoom;

  // Drag-to-spin state (persists between drags, like a real globe).
  const dragPhiOffset = React.useRef(0);
  const dragThetaOffset = React.useRef(0);
  const dragStart = React.useRef<{ x: number; y: number } | null>(null);
  const dragLive = React.useRef({ phi: 0, theta: 0 });
  const draggingRef = React.useRef(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Size the (square) canvas off the container width, and pause when scrolled
  // out of view so an idle Social tab isn't burning a GPU loop.
  React.useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 0) setSize(Math.round(Math.min(Math.max(w * 1.08, 520), 820)));
    });
    ro.observe(el);
    const io = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting;
      },
      { threshold: 0.02 }
    );
    io.observe(el);
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  // Non-passive wheel so we can zoom without scrolling the page away.
  React.useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const next = clampZoom(
        // Trackpads send small deltas; mice send larger chunks — normalize.
        zoomRef.current * Math.exp(-e.deltaY * 0.0016)
      );
      zoomRef.current = next;
      setZoom(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = React.useCallback((e: React.PointerEvent) => {
    dragStart.current = { x: e.clientX, y: e.clientY };
    draggingRef.current = true;
    setDragging(true);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, []);
  const onPointerUp = React.useCallback((e: React.PointerEvent) => {
    if (dragStart.current) {
      dragPhiOffset.current += dragLive.current.phi;
      dragThetaOffset.current += dragLive.current.theta;
      dragLive.current = { phi: 0, theta: 0 };
    }
    dragStart.current = null;
    draggingRef.current = false;
    setDragging(false);
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  }, []);
  const onPointerMoveDrag = React.useCallback((e: React.PointerEvent) => {
    if (!dragStart.current) return;
    dragLive.current = {
      phi: (e.clientX - dragStart.current.x) / 220,
      theta: (e.clientY - dragStart.current.y) / 500,
    };
  }, []);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size) return;

    let phi = 0;
    let frame = 0;
    let stopped = false;

    const globe = createGlobe(canvas, {
      devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      width: size * 2,
      height: size * 2,
      phi: 0,
      theta: THETA,
      dark: 1,
      // diffuse 0 = no lambert shading on the sphere body, so the "water"
      // between dots renders flat black instead of a lit blue-gray ball.
      // With mapBaseBrightness 0 the only lit pixels on the globe are the
      // landmass dots themselves.
      diffuse: 0,
      mapSamples: 26000,
      mapBrightness: 9,
      mapBaseBrightness: 0,
      // White dots on black. The hue comes entirely from the CSS
      // `mix-blend-mode: color` sweep over this canvas — that blend mode
      // keeps the backdrop's luminance, so black water stays black and only
      // the white dots take on color, one at a time as the gradient slides.
      baseColor: [1, 1, 1],
      markerColor: markerRgb,
      // Atmosphere off — cobe's glow was blowing out into a white halo
      // around the crest. The lens flare below is the deliberate version.
      glowColor: [0, 0, 0],
      opacity: 1,
      markerElevation: 0,
      // Tiny WebGL dots for everyone with a location — DOM avatars are
      // density-culled separately so crowded regions stay readable.
      markers: allMarkers.map((m) => ({ location: m.coords, size: 0.014 })),
    });

    const center = size / 2;
    const radius = 0.4 * size; // 0.8 sphere radius, NDC -> px on a square canvas

    function tick() {
      if (stopped) return;
      const hovered = hoverRef.current;
      const reduce = reducedRef.current || !visibleRef.current;
      const liveMarkers = markersRef.current;

      const autoSpeed = reduce
        ? 0
        : hovered
          ? BASE_SPEED * 0.12
          : BASE_SPEED;
      if (!draggingRef.current) phi += autoSpeed;

      const effPhi = phi + dragPhiOffset.current + dragLive.current.phi;
      const effTheta = Math.max(
        -1.4,
        Math.min(1.4, THETA + dragThetaOffset.current + dragLive.current.theta)
      );

      globe.update({ phi: effPhi, theta: effTheta });

      for (const m of liveMarkers) {
        const el = pinRefs.current.get(m.id);
        if (!el) continue;
        const surface = project(m.coords, effPhi, effTheta, SPHERE_R);
        const pin = project(m.coords, effPhi, effTheta, SPHERE_R * PIN_R);
        // Facing away — fade out rather than pop, and stop taking pointers.
        const facing = surface.z / SPHERE_R;
        const opacity = facing <= 0.06 ? 0 : Math.min(1, (facing - 0.06) / 0.18);
        const px = center + (pin.x / SPHERE_R) * radius;
        const py = center - (pin.y / SPHERE_R) * radius;
        const sx = center + (surface.x / SPHERE_R) * radius;
        const sy = center - (surface.y / SPHERE_R) * radius;
        el.style.opacity = String(opacity);
        el.style.pointerEvents = opacity > 0.55 ? "auto" : "none";
        el.style.transform = `translate3d(${px}px, ${py}px, 0)`;
        el.style.setProperty("--stalk-len", `${Math.hypot(px - sx, py - sy)}px`);
        el.style.setProperty(
          "--stalk-rot",
          `${(Math.atan2(sy - py, sx - px) * 180) / Math.PI}deg`
        );
        el.style.zIndex = String(10 + Math.round(facing * 40));
      }

      frame = requestAnimationFrame(tick);
    }

    tick();
    const t0 = setTimeout(() => setReady(true), 80);

    return () => {
      stopped = true;
      clearTimeout(t0);
      cancelAnimationFrame(frame);
      globe.destroy();
      setReady(false);
    };
  }, [size, allMarkers, markerRgb, glowRgb]);

  function open(m: GlobeMarker) {
    if (m.handle) router.push(`/artist/${m.handle}`);
    else if (m.personId) onOpenPerson?.(m.personId);
  }

  const height = GLOW_PAD + Math.round(size * VISIBLE);

  return (
    <div
      ref={rootRef}
      className={cn("relative w-full overflow-hidden touch-none select-none", className)}
      style={{
        height: height || undefined,
        // Gentle falloff toward the crop — keeps most of the visible disc
        // solid, then softens only near the bottom edge.
        WebkitMaskImage:
          "linear-gradient(to bottom, #000 0%, #000 58%, rgba(0,0,0,0.75) 82%, transparent 100%)",
        maskImage:
          "linear-gradient(to bottom, #000 0%, #000 58%, rgba(0,0,0,0.75) 82%, transparent 100%)",
      }}
      onMouseLeave={() => setHoverId(null)}
      onPointerMove={onPointerMoveDrag}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="absolute left-1/2"
        style={{
          width: size,
          height: size,
          top: GLOW_PAD,
          cursor: dragging ? "grabbing" : "grab",
          transform: `translateX(-50%) scale(${zoom})`,
          transformOrigin: "50% 42%",
        }}
      >
        {/* Atmosphere — soft outer glow only. Box-shadow on a circle that
            matches the sphere disc, sitting BEHIND the clipped globe so
            nothing additive lands on the planet face and there's no rim
            stroke between glow and surface. */}
        <div
          className={cn(
            "pointer-events-none absolute inset-[10%] rounded-full",
            !reduced && "globe-atmosphere"
          )}
          style={{
            boxShadow: `0 0 48px 6px rgb(${iceCss} / 0.14), 0 0 100px 20px rgb(${amberCss} / 0.045)`,
            opacity: ready ? 1 : 0,
            transition: "opacity 700ms",
          }}
          aria-hidden
        />

        {/* Globe disc — clipped to the sphere so canvas AA / overlay edges
            can't draw a black or white ring at the limb. Everything inside
            is the planet; atmosphere lives only outside via the glow above. */}
        <div
          className="absolute inset-[10%] overflow-hidden rounded-full"
          style={{
            background:
              "linear-gradient(160deg, rgb(30 33 46) 0%, rgb(22 24 34) 45%, rgb(14 15 21) 100%)",
            opacity: ready ? 1 : 0,
            transition: "opacity 700ms",
          }}
        >
          {/* `contrast` crushes the sphere body to true black while `screen`
              makes that black transparent against the fixed CSS ocean. Only
              the bright land dots remain, so animation can never change the
              ocean luminance or the apparent silhouette.
              Canvas is scaled up so cobe's 0.8-radius sphere fills this
              clipped disc edge-to-edge. */}
          <canvas
            ref={canvasRef}
            width={size * 2}
            height={size * 2}
            className="absolute"
            style={{
              /* Sphere is 80% of the square canvas. Overscan it slightly past
                 the fixed CSS crop so cobe's dark antialiased limb can never
                 rotate into view as a temporary black outline. */
              top: "-13.5%",
              left: "-13.5%",
              width: "127%",
              height: "127%",
              contain: "layout paint size",
              filter: "contrast(2.4) brightness(1.1)",
              mixBlendMode: "screen",
            }}
            aria-hidden
          />

          {/* Stable inner edge. The WebGL canvas can otherwise expose a dark
              antialias pixel at different longitudes.
              Divide by zoom so this cap stays visually one pixel wide. */}
          <div
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              boxShadow: `inset 0 0 0 ${1.25 / zoom}px rgb(27 30 42)`,
            }}
            aria-hidden
          />
        </div>

        {markers.map((m) => {
          const hovered = hoverId === m.id;
          return (
            <div
              key={m.id}
              ref={(el) => {
                pinRefs.current.set(m.id, el);
              }}
              className="absolute left-0 top-0 size-0"
              style={{ opacity: 0, willChange: "transform, opacity" }}
            >
              {/* Stalk down to the surface — length/angle come from the loop. */}
              <span
                className="pointer-events-none absolute left-0 top-0 block h-px origin-left bg-gradient-to-r from-ice/70 to-transparent"
                style={{
                  width: "var(--stalk-len, 0px)",
                  transform: "rotate(var(--stalk-rot, 0deg))",
                }}
                aria-hidden
              />
              <button
                type="button"
                onMouseEnter={() => setHoverId(m.id)}
                onMouseLeave={() => setHoverId((cur) => (cur === m.id ? null : cur))}
                onFocus={() => setHoverId(m.id)}
                onBlur={() => setHoverId((cur) => (cur === m.id ? null : cur))}
                onClick={() => open(m)}
                aria-label={`${m.name} — ${m.label}`}
                className={cn(
                  "absolute -left-5 -top-5 flex size-10 items-center justify-center",
                  "overflow-hidden rounded-full border bg-bg-1 shadow-e2",
                  "transition-[transform,border-color,box-shadow] duration-300",
                  hovered
                    ? "scale-[1.35] border-ice/70 shadow-e3"
                    : "border-line hover:border-ice/40"
                )}
              >
                <ArtistMark
                  emblemUrl={m.emblemUrl}
                  paletteId={m.paletteId}
                  iceColor={m.iceColor}
                  amberColor={m.amberColor}
                  name={m.name}
                  size={18}
                  className="size-full rounded-full object-cover"
                />
              </button>

              {hovered ? (
                <div className="pointer-events-none absolute -left-24 bottom-6 z-50 w-48">
                  {/* Solid, not `bg-bg-1/95` — that class can't carry an
                      opacity modifier (bg-1 is a raw CSS var, not the
                      Tailwind rgb-channel color format), so it silently
                      rendered fully transparent. */}
                  <div className="rounded-card border border-line bg-bg-1 p-2.5 text-left shadow-e3">
                    <p className="truncate text-sm font-medium text-text-hi">{m.name}</p>
                    <p className="truncate text-[11px] text-text-lo">{m.detail}</p>
                    <p className="mt-1 truncate text-[11px] text-ice">{m.label}</p>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Horizon scrim — light dissolve near the crop, not a heavy wipe. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%]"
        style={{
          background:
            "linear-gradient(to top, var(--bg-0) 0%, transparent 100%)",
        }}
        aria-hidden
      />

      {allMarkers.length > 0 ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-3 px-3">
          <p className="text-[10px] text-text-lo">
            {culled
              ? "Scroll to zoom — denser areas open up as you get closer"
              : zoom > 1.04
                ? "Scroll to zoom"
                : "Scroll to zoom · drag to spin"}
          </p>
          {zoom > 1.04 ? (
            <button
              type="button"
              className="pointer-events-auto text-[10px] text-ice hover:underline"
              onClick={() => {
                zoomRef.current = ZOOM_MIN;
                setZoom(ZOOM_MIN);
              }}
            >
              Reset
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
