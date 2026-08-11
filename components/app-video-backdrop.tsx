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
 */

import * as React from "react";
import { isLightfieldKillSwitch, prefersReducedMotion } from "@/lib/lightfield";
import { cn } from "@/lib/utils";

const LOOP_SRC = "/calendar/loop.mp4?v=0.113.0";
const POSTER_SRC = "/calendar/loop-poster.jpg?v=0.113.0";

export function AppVideoBackdrop({ className }: { className?: string }) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  // null until the effect runs, so the server render and the first paint show
  // the still poster rather than guessing at the motion preference.
  const [motionOk, setMotionOk] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    setMotionOk(!isLightfieldKillSwitch() && !prefersReducedMotion());
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

  return (
    <div className={cn("pointer-events-none overflow-hidden", className)} aria-hidden>
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
          color wash remains visible without competing with the calendar.

          An earlier pass graded this scrim instead, to claw back visibility
          the footage did not have. That was backwards: the source is a bright
          core on a near-black surround, so its energy sat dead centre under
          the month grid while the *exposed* regions held pixels of 2–20, and
          the grading then darkened those regions hardest. Measured, the
          backdrop moved composited pixels by 0–1 out of 255 against a --bg-0
          of 10 — invisible. The fix belonged in the asset: a wide blur
          spreads the core into an even field and a level lift raises the
          surround to ~83, which survives an 82% scrim while keeping dense UI
          controls easy to read. */}
      <div className="absolute inset-0 bg-bg-0/[0.82]" />
    </div>
  );
}
