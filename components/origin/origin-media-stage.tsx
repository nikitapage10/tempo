"use client";

import * as React from "react";
import { originAsset, type OriginMediaKey } from "@/lib/origin/media";
import { cn } from "@/lib/utils";

/**
 * The ORIGIN video stage.
 *
 * Exactly two <video> elements are mounted, in identical full-screen geometry,
 * over an opaque poster floor. One is visible; the other is the standby.
 * Changing `clip` loads the new asset into the standby, plays it while it is
 * still invisible, waits for it to paint a decoded frame, and only then swaps
 * opacity. The outgoing element is not released until the swap has finished, so
 * the page background is never exposed and no black frame appears between clips.
 *
 * The overlap is deliberately brief — this should read as one continuous
 * environment changing state, not a dissolve between two scenes.
 */

/**
 * Long enough to read as one clip melting into the next rather than a cut.
 *
 * This only blends properly because the experience advances the phase *before*
 * the outgoing transition ends (see CROSSFADE_LEAD_MS in origin-experience) —
 * so the outgoing clip is still moving underneath for the whole blend. Swapping
 * on `ended` instead would crossfade from a frozen last frame, which is what
 * made the old handoff read as a stop-start.
 */
const HANDOFF_MS = 1100;
/**
 * The first clip is not a handoff — there is nothing underneath it. It comes up
 * out of the poster slowly, so the film reads as light arriving rather than a
 * cut to a playing video.
 */
const FIRST_FADE_MS = 2000;
/** The transition-to-scrub handoff is intentionally slow and starts over a
 * held true final frame, so decoder/compositor timing cannot read as a jump. */
const SCRUB_FADE_MS = 1800;
const FINAL_STILL_FADE_MS = 1050;
const FINAL_STILL_LEAD_SECONDS = 1.35;
/** Audio reaches silence before a clip is paused or naturally ends. */
const AUDIO_FADE_MS = 1100;
const AUDIO_TAIL_SECONDS = 1.5;
/** If a frame never paints, swap anyway rather than freezing the flow. */
const PAINT_TIMEOUT_MS = 2500;

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: () => void) => number;
};

/** Resolves once the element has actually painted a frame of its current source. */
function whenPainted(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // Declared before `done` on purpose: `done` removes these listeners, and
    // the requestVideoFrameCallback path below returns early — so if `check`
    // were declared after that return it would never be initialized, and every
    // call to `done` would throw instead of resolving.
    const check = () => {
      if (video.readyState >= 2) requestAnimationFrame(() => requestAnimationFrame(done));
    };

    const done = () => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      video.removeEventListener("loadeddata", check);
      video.removeEventListener("playing", check);
      resolve();
    };

    timer = setTimeout(done, PAINT_TIMEOUT_MS);

    const v = video as VideoWithFrameCallback;
    if (typeof v.requestVideoFrameCallback === "function") {
      // The only signal meaning "a frame is on screen" rather than "a frame
      // could be decoded".
      v.requestVideoFrameCallback(() => done());
      return;
    }
    video.addEventListener("loadeddata", check);
    video.addEventListener("playing", check);
    check();
  });
}

/** Seek a paused video and wait until the target frame reaches the compositor. */
function seekToPaintedFrame(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const done = () => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    const onSeeked = () => {
      const v = video as VideoWithFrameCallback;
      if (typeof v.requestVideoFrameCallback === "function") {
        v.requestVideoFrameCallback(() => done());
      } else {
        requestAnimationFrame(() => requestAnimationFrame(done));
      }
    };

    timer = setTimeout(done, PAINT_TIMEOUT_MS);
    video.addEventListener("seeked", onSeeked, { once: true });
    video.currentTime = time;
  });
}

export type OriginMediaStageProps = {
  clip: { key: OriginMediaKey; loop: boolean } | null;
  /** Poster shown beneath both layers until a frame is confirmed visible. */
  posterSrc?: string;
  /** Static mode renders the poster only — no video is loaded or played. */
  staticMode?: boolean;
  /**
   * Play with audio. Only ever true after the artist's opening tap, since
   * browsers reject audible playback without a user gesture.
   */
  soundOn?: boolean;
  onEnded?: () => void;
  onVisible?: (key: OriginMediaKey) => void;
  onError?: (key: OriginMediaKey) => void;
  /** Handed the active element so the scroll scrubber can drive it directly. */
  onActiveElement?: (el: HTMLVideoElement | null, key: OriginMediaKey | null) => void;
  className?: string;
  children?: React.ReactNode;
};

export function OriginMediaStage({
  clip,
  posterSrc,
  staticMode = false,
  soundOn = false,
  onEnded,
  onVisible,
  onError,
  onActiveElement,
  className,
  children,
}: OriginMediaStageProps) {
  const aRef = React.useRef<HTMLVideoElement>(null);
  const bRef = React.useRef<HTMLVideoElement>(null);

  const [activeSlot, setActiveSlot] = React.useState<"a" | "b">("a");
  /**
   * The outgoing element during a blend. It stays at full opacity underneath
   * while the incoming one fades in on top.
   *
   * Cross-fading both at once is what caused the flash: at the midpoint each
   * clip sat near 50%, and two half-transparent layers over the black floor
   * composite darker than either — a dip to black in the middle of every
   * handoff. Only the incoming layer animates now.
   */
  const [holdSlot, setHoldSlot] = React.useState<"a" | "b" | null>(null);
  const [painted, setPainted] = React.useState(false);
  /** True while the very first clip is rising out of the poster. */
  const [firstReveal, setFirstReveal] = React.useState(true);
  /** Uses the frame-matched blend length for the scrub handoff. */
  const [slowBlend, setSlowBlend] = React.useState(false);
  /** A real exported last frame covers browsers that rewind an ended video. */
  const [handoffStill, setHandoffStill] = React.useState<{
    src: string;
    visible: boolean;
    fadeMs: number;
  } | null>(null);
  const finalStillPrimedRef = React.useRef<string | null>(null);

  const activeSlotRef = React.useRef(activeSlot);
  activeSlotRef.current = activeSlot;
  /** Source currently assigned to each element, tracked outside React. */
  const slotKeyRef = React.useRef<{ a: OriginMediaKey | null; b: OriginMediaKey | null }>({
    a: null,
    b: null,
  });

  const cbRef = React.useRef({ onEnded, onVisible, onError, onActiveElement });
  cbRef.current = { onEnded, onVisible, onError, onActiveElement };
  // Read inside the handoff without making it a dependency — flipping sound on
  // must not restart a clip that is already playing.
  const soundOnRef = React.useRef(soundOn);
  soundOnRef.current = soundOn;

  /** Unmute whatever is already on screen the moment sound is switched on. */
  React.useEffect(() => {
    const el = (activeSlotRef.current === "a" ? aRef.current : bRef.current) ?? null;
    const key = slotKeyRef.current[activeSlotRef.current];
    if (!el || !key) return;
    // Loops stay silent even after sound is unlocked — see the handoff above.
    const audible = soundOn && originAsset(key).mode === "transition";
    el.muted = !audible;
    if (audible) el.volume = 1;
  }, [soundOn]);

  const clipKey = clip?.key ?? null;
  const clipLoop = clip?.loop ?? false;

  /** Warm the final still before the transition ends so it can take over in
   * the same paint where an ended video might otherwise snap back to frame 0. */
  React.useEffect(() => {
    finalStillPrimedRef.current = null;
    if (!clipKey) return;
    const src = originAsset(clipKey).finalPoster;
    if (!src) return;
    const image = new Image();
    image.src = src;
  }, [clipKey]);

  React.useEffect(() => {
    if (staticMode || !clipKey) return;
    const current = activeSlotRef.current;
    if (slotKeyRef.current[current] === clipKey) return;

    const incomingSlot: "a" | "b" = current === "a" ? "b" : "a";
    const incoming = (incomingSlot === "a" ? aRef.current : bRef.current) ?? null;
    if (!incoming) return;

    let cancelled = false;
    const asset = originAsset(clipKey);
    slotKeyRef.current = { ...slotKeyRef.current, [incomingSlot]: clipKey };

    // Assigned imperatively rather than through JSX so load, play and the paint
    // check can be sequenced against each other.
    incoming.src = asset.src;
    incoming.loop = clipLoop;
    // Only transitions carry audio. The loops hold for an unknown length of
    // time while the artist types or talks, and a bed of sound cycling under
    // that becomes noise rather than atmosphere.
    const audible = soundOnRef.current && asset.mode === "transition";
    // Starts silent regardless: it is playing underneath the outgoing clip, and
    // two audible tracks at once would be worse than none. Ramped up below.
    incoming.muted = !audible;
    incoming.volume = audible ? 0 : 1;
    incoming.playsInline = true;
    incoming.load();

    void (async () => {
      try {
        if (incoming.currentTime !== 0) incoming.currentTime = 0;
        if (asset.mode !== "scrub") {
          await incoming.play().catch(() => {
            /* muted + playsInline is permitted; ignore autoplay races */
          });
          if (cancelled) return;
          await whenPainted(incoming);
        } else {
          // A seek-only element does not reliably paint before it is visible.
          // Prime the decoder invisibly, then return to an explicitly painted
          // opening frame before the transition's held last frame blends away.
          incoming.muted = true;
          await incoming.play().catch(() => {});
          if (cancelled) return;
          await whenPainted(incoming);
          incoming.pause();
          if (cancelled) return;
          // 1ms is still the first 24fps frame, but unlike assigning zero to an
          // already-zero playhead it reliably fires a seek/decode cycle.
          await seekToPaintedFrame(incoming, 0.001);
        }
        if (cancelled) return;

        // Nothing to hold under the first clip — it rises out of the poster.
        const isFirst = slotKeyRef.current[current] === null;
        // The scrub asset is seeked, not played. Its opening frame is matched
        // to the transition's final frame, so the short dissolve only hides
        // compositor timing without creating a perceptible frozen hold.
        const blendMs = asset.mode === "scrub" ? SCRUB_FADE_MS : HANDOFF_MS;
        setSlowBlend(asset.mode === "scrub");
        if (!isFirst) setHoldSlot(current);
        setActiveSlot(incomingSlot);
        setPainted(true);
        if (asset.mode === "scrub") {
          // The incoming scrub video rises above the opaque final still. Only
          // release that still once the much slower dissolve is complete.
          window.setTimeout(() => setHandoffStill(null), SCRUB_FADE_MS + 120);
        }
        if (isFirst) {
          window.setTimeout(() => {
            if (!cancelled) setFirstReveal(false);
          }, FIRST_FADE_MS);
        }
        cbRef.current.onVisible?.(clipKey);
        cbRef.current.onActiveElement?.(incoming, clipKey);

        const outgoing = (current === "a" ? aRef.current : bRef.current) ?? null;

        // Fade both sides independently. In particular, transition -> silent
        // loop still needs to ramp the outgoing soundtrack all the way to zero;
        // pausing or detaching a non-zero signal is what produced the crackle.
        const outgoingAudible = Boolean(
          outgoing && !outgoing.muted && outgoing.volume > 0
        );
        if (audible || outgoingAudible) {
          const startedAt = performance.now();
          const outgoingStart = outgoing?.volume ?? 0;
          const fadeMs = Math.min(blendMs, AUDIO_FADE_MS);
          const ramp = () => {
            if (cancelled) return;
            const t = Math.min(1, (performance.now() - startedAt) / fadeMs);
            const eased = t * t * (3 - 2 * t);
            if (audible) incoming.volume = Math.sin((eased * Math.PI) / 2);
            if (outgoingAudible && outgoing) {
              const ceiling = outgoingStart * Math.cos((eased * Math.PI) / 2);
              outgoing.volume = Math.min(outgoing.volume, ceiling);
            }
            if (t < 1) requestAnimationFrame(ramp);
          };
          requestAnimationFrame(ramp);
        }

        // Released only after the blend has finished, so it stays underneath —
        // and still playing — for the whole of it.
        window.setTimeout(() => {
          if (cancelled || !outgoing) return;
          // By now the incoming layer is fully opaque on top, so dropping the
          // one underneath is invisible.
          setHoldSlot((s) => (s === current ? null : s));
          outgoing.volume = 0;
          outgoing.pause();
          slotKeyRef.current = { ...slotKeyRef.current, [current]: null };
          outgoing.removeAttribute("src");
          outgoing.load();
        }, blendMs + 60);
      } catch {
        if (!cancelled) cbRef.current.onError?.(clipKey);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clipKey, clipLoop, staticMode]);

  /** Keep the loop flag live for a clip already on screen. */
  React.useEffect(() => {
    const el = (activeSlot === "a" ? aRef.current : bRef.current) ?? null;
    if (el) el.loop = clipLoop;
  }, [clipLoop, activeSlot]);

  /**
   * Ease every transition to silence over its last frames. If it owns a true
   * final still, begin dissolving into that still before `ended`, so the browser
   * never gets one paint in which it can rewind the video to frame zero.
   */
  React.useEffect(() => {
    if (staticMode || clipLoop) return;
    const slot = activeSlotRef.current;
    const el = (slot === "a" ? aRef.current : bRef.current) ?? null;
    const key = slotKeyRef.current[slot];
    if (!el || !key || originAsset(key).mode !== "transition") return;
    const finalPoster = originAsset(key).finalPoster;

    let raf = 0;
    const softenTail = () => {
      if (Number.isFinite(el.duration) && el.duration > 0 && !el.ended) {
        const remaining = el.duration - el.currentTime;
        if (
          finalPoster &&
          remaining <= FINAL_STILL_LEAD_SECONDS &&
          finalStillPrimedRef.current !== key
        ) {
          finalStillPrimedRef.current = key;
          setHandoffStill({ src: finalPoster, visible: false, fadeMs: FINAL_STILL_FADE_MS });
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setHandoffStill((currentStill) =>
                currentStill?.src === finalPoster
                  ? { ...currentStill, visible: true }
                  : currentStill
              );
            });
          });
        }
        if (!el.muted && remaining <= AUDIO_TAIL_SECONDS) {
          const t = Math.max(0, Math.min(1, remaining / AUDIO_TAIL_SECONDS));
          const ceiling = t * t * (3 - 2 * t);
          el.volume = Math.min(el.volume, ceiling);
        }
        raf = requestAnimationFrame(softenTail);
      }
    };
    raf = requestAnimationFrame(softenTail);
    return () => cancelAnimationFrame(raf);
  }, [activeSlot, clipKey, clipLoop, staticMode]);

  /** A hidden tab throttles or pauses playback; resume so the loop is running
   *  when the artist returns rather than frozen mid-frame. */
  React.useEffect(() => {
    const onVis = () => {
      const el = (activeSlotRef.current === "a" ? aRef.current : bRef.current) ?? null;
      if (!el) return;
      if (document.visibilityState === "visible") {
        if (el.paused && el.loop) void el.play().catch(() => {});
      } else {
        el.pause();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  /** Stop all speculative work on unmount. */
  React.useEffect(() => {
    const a = aRef.current;
    const b = bRef.current;
    return () => {
      [a, b].forEach((el) => {
        if (!el) return;
        el.pause();
        el.removeAttribute("src");
        el.load();
      });
      cbRef.current.onActiveElement?.(null, null);
    };
  }, []);

  const handleEnded = (slot: "a" | "b") => () => {
    if (slot !== activeSlotRef.current) return;
    const key = slotKeyRef.current[slot];
    const finalPoster = key ? originAsset(key).finalPoster : undefined;
    if (finalPoster) {
      setHandoffStill((currentStill) =>
        currentStill ?? { src: finalPoster, visible: true, fadeMs: 0 }
      );
    }
    cbRef.current.onEnded?.();
  };
  const handleError = (slot: "a" | "b") => () => {
    const key = slotKeyRef.current[slot];
    if (key && slot === activeSlotRef.current) cbRef.current.onError?.(key);
  };

  const videoClass = "absolute inset-0 h-full w-full object-cover";

  return (
    <div className={cn("fixed inset-0 overflow-hidden bg-[var(--bg-0)]", className)}>
      {/* Opaque floor — the page background is never what shows through. */}
      <div className="absolute inset-0 bg-[var(--bg-0)]" aria-hidden />
      {posterSrc ? (
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-500 motion-reduce:transition-none"
          // Held at full strength while the first clip rises over it, so the
          // reveal is the film gaining light rather than two layers dipping
          // through each other.
          style={{
            backgroundImage: `url(${posterSrc})`,
            opacity: painted && !staticMode && !firstReveal ? 0 : 1,
          }}
        />
      ) : null}

      {!staticMode
        ? (["a", "b"] as const).map((slot) => (
            <video
              key={slot}
              ref={slot === "a" ? aRef : bRef}
              className={videoClass}
              style={{
                opacity: activeSlot === slot || holdSlot === slot ? 1 : 0,
                // The incoming layer must sit above the held one, otherwise it
                // would fade in underneath an opaque clip and never be seen.
                zIndex: activeSlot === slot ? (slowBlend ? 3 : 2) : 1,
                // Only the incoming layer animates; the held one is static
                // until it is dropped.
                transition:
                  activeSlot === slot
                    ? `opacity ${firstReveal ? FIRST_FADE_MS : slowBlend ? SCRUB_FADE_MS : HANDOFF_MS}ms ease-in-out`
                    : "none",
              }}
              // `muted` is managed imperatively during the handoff (and by the
              // sound effect above); declaring it here would let a re-render
              // silence a clip mid-blend.
              playsInline
              preload="auto"
              tabIndex={-1}
              onEnded={handleEnded(slot)}
              onError={handleError(slot)}
              // Decorative: the copy layer above carries all meaning.
              aria-hidden
            />
          ))
        : null}

      {handoffStill ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[2] bg-cover bg-center transition-opacity ease-out motion-reduce:transition-none"
          style={{
            backgroundImage: `url(${handoffStill.src})`,
            opacity: handoffStill.visible ? 1 : 0,
            transitionDuration: `${handoffStill.fadeMs}ms`,
          }}
        />
      ) : null}

      <OriginGrain />
      {/* A second, finer pass in screen blend puts actual highlights into the
          blacks, which is where grain is visible at all on this footage. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[3] opacity-[0.16] mix-blend-screen"
        style={{
          backgroundImage: `url("${GRAIN_URI}")`,
          backgroundRepeat: "repeat",
          backgroundSize: "140px 140px",
          animation: "origin-grain 500ms steps(2) infinite reverse",
        }}
      />

      {children}
    </div>
  );
}

/**
 * Film grain over the whole stage.
 *
 * Fractal noise baked into a data URI — no extra request, no WebGL context, and
 * it sits above both video layers so the texture stays constant across a
 * handoff rather than crossfading with the picture. The animation walks the
 * tile position so the grain shimmers instead of reading as a static overlay.
 *
 * Sits below the copy layer: the point is to sell the footage, not to make text
 * harder to read.
 */
const GRAIN_URI =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'>
      <filter id='n'>
        <feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/>
        <feColorMatrix type='saturate' values='0'/>
      </filter>
      <rect width='200' height='200' filter='url(#n)' opacity='0.9'/>
    </svg>`
  );

function OriginGrain() {
  return (
    <div
      aria-hidden
      // Overlay alone barely registers on footage this dark — most of the frame
      // is near black, where overlay leaves the base untouched. The second
      // soft-light pass in the shadow of this one is what makes it read.
      className="pointer-events-none absolute inset-0 z-[3] opacity-[0.55] mix-blend-soft-light motion-reduce:animate-none"
      style={{
        backgroundImage: `url("${GRAIN_URI}")`,
        backgroundRepeat: "repeat",
        backgroundSize: "200px 200px",
        animation: "origin-grain 700ms steps(3) infinite",
      }}
    />
  );
}
