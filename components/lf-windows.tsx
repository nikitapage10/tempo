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
};

type Ctx = {
  upsertHole: (hole: LfHole) => void;
  removeHole: (id: string) => void;
};

const LfWindowsContext = React.createContext<Ctx | null>(null);

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
        existing.rx === hole.rx
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

  const ctx = React.useMemo(
    () => ({ upsertHole, removeHole }),
    [upsertHole, removeHole]
  );

  React.useEffect(() => {
    upsertHoleRef.current = upsertHole;
    removeHoleRef.current = removeHole;
  }, [upsertHole, removeHole]);

  const list = React.useMemo(() => Array.from(holes.values()), [holes]);
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
  enabled = true
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
      upsertHoleRef.current?.({
        id: idRef.current,
        x: r.left,
        y: r.top,
        w: r.width,
        h: r.height,
        rx: radius,
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
  }, [enabled]);

  return ref;
}

/** Declarative window — punches chrome and stays visually transparent. */
export function LfWindow({
  className,
  enabled = true,
  children,
  style,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  enabled?: boolean;
}) {
  const ref = useLfWindow<HTMLDivElement>(enabled);
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
