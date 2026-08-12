"use client";

/**
 * Persistent app backdrop — a short blurred loop behind the workspace.
 *
 * The blur is baked into the asset (ffmpeg gblur) rather than applied with
 * CSS. A `filter: blur()` on a *playing* video makes the compositor re-blur
 * every decoded frame for as long as the page is open, which is real per-frame
 * GPU work for a result that never changes shape. Pre-blurring makes it free
 * at runtime, and the soft footage remains very small after compression.
 *
 * Because it is pre-blurred there is nothing to lose by rendering it small:
 * the asset is 640x360 and gets scaled up, which on a soft field is invisible.
 *
 * Unlike the shader backdrops this takes no WebGL context at all, so the root
 * Spectra lightfield keeps the page's only one.
 *
 * Thin lightfield slits (page-header rules, rail ticks) are cut out of this
 * layer so the shader can still run through those lines while the video
 * keeps washing the rest of the page.
 */

import * as React from "react";
import { isLightfieldKillSwitch, prefersReducedMotion } from "@/lib/lightfield";
import { shouldCutVideoForHole, useLfHoles } from "@/components/lf-windows";
import { cn } from "@/lib/utils";

const LOOP_SRC = "/calendar/loop.mp4?v=0.113.0";
const POSTER_SRC = "/calendar/loop-poster.jpg?v=0.113.0";

export function AppVideoBackdrop({ className }: { className?: string }) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  // null until the effect runs, so the server render and the first paint show
  // the still poster rather than guessing at the motion preference.
  const [motionOk, setMotionOk] = React.useState<boolean | null>(null);
  const [box, setBox] = React.useState({ x: 0, y: 0, w: 0, h: 0 });
  const holes = useLfHoles();
  const maskId = React.useId().replace(/:/g, "");

  const localCuts = React.useMemo(() => {
    if (box.w <= 0 || box.h <= 0) return [];
    return holes.filter(shouldCutVideoForHole).map((h) => ({
      id: h.id,
      x: h.x - box.x,
      y: h.y - box.y,
      w: h.w,
      h: h.h,
      rx: h.rx ?? 0,
      field: !!h.field,
    }));
  }, [holes, box]);

  React.useEffect(() => {
    setMotionOk(!isLightfieldKillSwitch() && !prefersReducedMotion());
  }, []);

  React.useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const sync = () => {
      const r = el.getBoundingClientRect();
      setBox({ x: r.left, y: r.top, w: r.width, h: r.height });
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
    };
  }, []);

  React.useEffect(() => {
    if (!motionOk) return;
    const video = videoRef.current;
    if (!video) return;

    // Browsers throttle background tabs unevenly; pausing explicitly means a
    // tab left open on the Calendar decodes nothing at all.
    const onVisibility = () => {
      if (document.hidden) video.pause();
      else void video.play().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onVisibility);
    // Autoplay can still be refused (some power-saving modes ignore muted
    // autoplay). The poster stays underneath, so a refusal degrades to the
    // still frame rather than to nothing. Only start if the tab is actually
    // in front — mounting behind another tab should decode nothing until the
    // visibility handler above says otherwise.
    if (!document.hidden) void video.play().catch(() => undefined);

    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [motionOk]);

  const maskUrl = localCuts.length > 0 && box.w > 0 ? `url(#${maskId})` : undefined;

  return (
    <div
      ref={rootRef}
      className={cn("pointer-events-none overflow-hidden", className)}
      aria-hidden
    >
      {maskUrl ? (
        <svg
          className="pointer-events-none absolute left-0 top-0 h-0 w-0 overflow-hidden"
          width={box.w}
          height={box.h}
          aria-hidden
        >
          <defs>
            <mask
              id={maskId}
              maskUnits="userSpaceOnUse"
              x={0}
              y={0}
              width={box.w}
              height={box.h}
            >
              <rect x={0} y={0} width={box.w} height={box.h} fill="white" />
              {localCuts.map((h) => (
                <rect
                  key={h.id}
                  x={h.x}
                  y={h.y}
                  width={Math.max(0, h.w)}
                  height={Math.max(0, h.h)}
                  rx={h.rx}
                  ry={h.rx}
                  /* Field heroes: dim the video (~45% remains) so Spectra
                     lines show through without killing the wash. Thin slits
                     stay fully cut so divider light stays crisp. */
                  fill={h.field ? "#8a8a8a" : "black"}
                />
              ))}
            </mask>
          </defs>
        </svg>
      ) : null}

      <div
        className="absolute inset-0"
        style={
          maskUrl
            ? { maskImage: maskUrl, WebkitMaskImage: maskUrl }
            : undefined
        }
      >
        {/* Still gradient at the very back — covers the moment before the poster
            decodes, and any case where neither poster nor video loads. */}
        <div className="spectra-still absolute inset-0" />

        {/* The poster as a plain layer rather than the video's own poster
            attribute: it then also covers a refused autoplay, not just the load. */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${POSTER_SRC})` }}
        />

        {motionOk ? (
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full scale-105 object-cover"
            src={LOOP_SRC}
            poster={POSTER_SRC}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            disablePictureInPicture
            tabIndex={-1}
          />
        ) : null}

        {/* Body copy never sits on raw imagery. This stays close to the design
            system's standard 85% floor, with a restrained lift so the softened
            color wash remains visible without competing with the calendar. */}
        <div className="absolute inset-0 bg-bg-0/[0.82]" />
      </div>
    </div>
  );
}
