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
const HANDOFF_MS = 620;
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
  const [painted, setPainted] = React.useState(false);

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
    if (!el) return;
    el.muted = !soundOn;
    if (soundOn) el.volume = 1;
  }, [soundOn]);

  const clipKey = clip?.key ?? null;
  const clipLoop = clip?.loop ?? false;

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
    // Always starts silent: it is playing underneath the outgoing clip, and two
    // audible tracks at once would be worse than none. Volume is ramped up
    // across the blend below.
    incoming.muted = !soundOnRef.current;
    incoming.volume = soundOnRef.current ? 0 : 1;
    incoming.playsInline = true;
    incoming.load();

    void (async () => {
      try {
        if (incoming.currentTime !== 0) incoming.currentTime = 0;
        // A scrub asset is positioned by the scroll driver, never auto-played.
        if (asset.mode !== "scrub") {
          await incoming.play().catch(() => {
            /* muted + playsInline is permitted; ignore autoplay races */
          });
        }
        if (cancelled) return;
        await whenPainted(incoming);
        if (cancelled) return;

        setActiveSlot(incomingSlot);
        setPainted(true);
        cbRef.current.onVisible?.(clipKey);
        cbRef.current.onActiveElement?.(incoming, clipKey);

        const outgoing = (current === "a" ? aRef.current : bRef.current) ?? null;

        // Ramp audio across the same window as the opacity blend, so sound and
        // picture arrive together instead of the track snapping over.
        if (soundOnRef.current) {
          const startedAt = performance.now();
          const ramp = () => {
            if (cancelled) return;
            const t = Math.min(1, (performance.now() - startedAt) / HANDOFF_MS);
            incoming.volume = t;
            if (outgoing && !outgoing.paused) outgoing.volume = 1 - t;
            if (t < 1) requestAnimationFrame(ramp);
          };
          requestAnimationFrame(ramp);
        }

        // Released only after the blend has finished, so it stays underneath —
        // and still playing — for the whole of it.
        window.setTimeout(() => {
          if (cancelled || !outgoing) return;
          outgoing.pause();
          slotKeyRef.current = { ...slotKeyRef.current, [current]: null };
          outgoing.removeAttribute("src");
          outgoing.load();
        }, HANDOFF_MS + 60);
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
    if (slot === activeSlotRef.current) cbRef.current.onEnded?.();
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
          style={{ backgroundImage: `url(${posterSrc})`, opacity: painted && !staticMode ? 0 : 1 }}
        />
      ) : null}

      {!staticMode
        ? (["a", "b"] as const).map((slot) => (
            <video
              key={slot}
              ref={slot === "a" ? aRef : bRef}
              className={videoClass}
              style={{
                opacity: activeSlot === slot ? 1 : 0,
                transition: `opacity ${HANDOFF_MS}ms linear`,
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

      {children}
    </div>
  );
}
