"use client";

/**
 * Lightfield window registry — punches holes in the full-viewport black
 * scrim so the root canvas shows through. Register any element that should
 * be a window; body copy stays on opaque surfaces or ≥85% scrims.
 */

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export type LfHole = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rx?: number;
  /** Large hero / reveal windows that should show Spectra through glass. */
  field?: boolean;
};

type Ctx = {
  upsertHole: (hole: LfHole) => void;
  removeHole: (id: string) => void;
  /** Live window rects — used to cut matching slits in the video backdrop. */
  holes: LfHole[];
};

const LfWindowsContext = React.createContext<Ctx | null>(null);

/** Thin slits — page headers, rail ticks, dividers. */
export function isLfSlit(hole: LfHole): boolean {
  return (hole.h <= 8 && hole.w >= 12) || (hole.w <= 8 && hole.h >= 12);
}

/** Holes that must be cut out of the video so the root Spectra field shows. */
export function shouldCutVideoForHole(hole: LfHole): boolean {
  return !!hole.field || isLfSlit(hole);
}

/** Read registered lightfield windows (empty outside the provider). */
export function useLfHoles(): LfHole[] {
  return React.useContext(LfWindowsContext)?.holes ?? [];
}

let holeSeq = 0;

export function LightfieldWindowsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [holes, setHoles] = React.useState<Map<string, LfHole>>(
    () => new Map()
  );
  const [mounted, setMounted] = React.useState(false);
  const [viewport, setViewport] = React.useState({ w: 0, h: 0 });

  React.useEffect(() => {
    setMounted(true);
    const sync = () =>
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  const upsertHole = React.useCallback((hole: LfHole) => {
    setHoles((prev) => {
      const existing = prev.get(hole.id);
      if (
        existing &&
        existing.x === hole.x &&
        existing.y === hole.y &&
        existing.w === hole.w &&
        existing.h === hole.h &&
        existing.rx === hole.rx &&
        existing.field === hole.field
      ) {
        return prev;
      }
      const next = new Map(prev);
      next.set(hole.id, hole);
      return next;
    });
  }, []);

  const removeHole = React.useCallback((id: string) => {
    setHoles((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const list = React.useMemo(() => Array.from(holes.values()), [holes]);

  const ctx = React.useMemo(
    () => ({ upsertHole, removeHole, holes: list }),
    [upsertHole, removeHole, list]
  );

  React.useEffect(() => {
    upsertHoleRef.current = upsertHole;
    removeHoleRef.current = removeHole;
  }, [upsertHole, removeHole]);

  const maskId = "tempo-lf-chrome-mask";

  return (
    <LfWindowsContext.Provider value={ctx}>
      {mounted && viewport.w > 0
        ? createPortal(
            <svg
              className="lf-chrome-overlay pointer-events-none fixed inset-0 z-[1] h-full w-full"
              width={viewport.w}
              height={viewport.h}
              aria-hidden
            >
              <defs>
                <mask
                  id={maskId}
                  maskUnits="userSpaceOnUse"
                  x={0}
                  y={0}
                  width={viewport.w}
                  height={viewport.h}
                >
                  <rect
                    x={0}
                    y={0}
                    width={viewport.w}
                    height={viewport.h}
                    fill="white"
                  />
                  {list.map((h) => (
                    <rect
                      key={h.id}
                      x={h.x}
                      y={h.y}
                      width={Math.max(0, h.w)}
                      height={Math.max(0, h.h)}
                      rx={h.rx ?? 0}
                      ry={h.rx ?? 0}
                      fill="black"
                    />
                  ))}
                </mask>
              </defs>
              <rect
                x={0}
                y={0}
                width={viewport.w}
                height={viewport.h}
                fill="#0A0A0C"
                mask={`url(#${maskId})`}
              />
            </svg>,
            document.body
          )
        : null}
      <div className="relative z-[2] min-h-screen">{children}</div>
    </LfWindowsContext.Provider>
  );
}

const upsertHoleRef: { current: ((h: LfHole) => void) | null } = {
  current: null,
};
const removeHoleRef: { current: ((id: string) => void) | null } = {
  current: null,
};

/**
 * Keep an element's screen rect punched through the black chrome.
 * The element itself should use `.lf-window` (transparent fill).
 */
export function useLfWindow<T extends HTMLElement = HTMLDivElement>(
  enabled = true,
  field = false
) {
  const ref = React.useRef<T | null>(null);
  const idRef = React.useRef(`lf-hole-${++holeSeq}`);

  React.useEffect(() => {
    if (!enabled) {
      removeHoleRef.current?.(idRef.current);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const publish = () => {
      const r = el.getBoundingClientRect();
      const radius = parseFloat(getComputedStyle(el).borderRadius) || 0;
      // Inset large field windows by 1px so Spectra can't fringe outside the
      // parent glass border and read as a stray line under the card.
      const inset = field && r.width > 24 && r.height > 24 ? 1 : 0;
      upsertHoleRef.current?.({
        id: idRef.current,
        x: r.left + inset,
        y: r.top + inset,
        w: Math.max(0, r.width - inset * 2),
        h: Math.max(0, r.height - inset * 2),
        rx: Math.max(0, radius - inset),
        field,
      });
    };

    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    window.addEventListener("scroll", publish, true);
    window.addEventListener("resize", publish);

    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", publish, true);
      window.removeEventListener("resize", publish);
      removeHoleRef.current?.(idRef.current);
    };
  }, [enabled, field]);

  return ref;
}

/** Declarative window — punches chrome and stays visually transparent. */
export function LfWindow({
  className,
  enabled = true,
  field = false,
  children,
  style,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  enabled?: boolean;
  /** Punch the video too so Spectra can wash a glass hero. */
  field?: boolean;
}) {
  const ref = useLfWindow<HTMLDivElement>(enabled, field);
  return (
    <div
      ref={ref}
      className={cn("lf-window", className)}
      style={style}
      {...rest}
    >
      {children}
    </div>
  );
}
