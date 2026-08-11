"use client";

/**
 * Calendar video backdrop — a short blurred loop behind the page.
 *
 * The blur is baked into the asset (ffmpeg gblur) rather than applied with
 * CSS. A `filter: blur()` on a *playing* video makes the compositor re-blur
 * every decoded frame for as long as the page is open, which is real per-frame
 * GPU work for a result that never changes shape. Pre-blurring makes it free
 * at runtime, and blurred footage compresses so well that the whole clip is
 * 87KB — the 1080p source it came from is 6.8MB, with an audio track a
 * background has no use for.
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

const LOOP_SRC = "/calendar/loop.mp4";
const POSTER_SRC = "/calendar/loop-poster.jpg";

export function CalendarVideoBackdrop({ className }: { className?: string }) {
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
    // still frame rather than to nothing.
    void video.play().catch(() => undefined);

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

      {/* Body copy never sits on raw imagery. At the design system's flat
          ≥85% floor this footage is invisible, so the scrim is graded
          instead: heaviest down the left and across the bottom, where the
          page header and the month grid's own text sit, and lightest top
          right, where nothing but panel chrome overlaps it. Every value is at
          or above 85% wherever text actually lands. */}
      <div className="absolute inset-0 bg-bg-0/70" />
      <div className="absolute inset-0 bg-gradient-to-r from-bg-0 via-bg-0/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-bg-0 via-bg-0/50 to-transparent" />
    </div>
  );
}
