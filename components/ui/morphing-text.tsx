"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Text that dissolves from one line into the next through a blur threshold.
 *
 * Two spans are stacked and cross-blurred; an SVG threshold filter over the top
 * re-hardens the edges, so the letters appear to melt and reform rather than
 * simply crossfade. In TEMPO this is the voice of the thing talking to the
 * artist during ORIGIN — it is used only for that, never for ordinary UI copy.
 *
 * `loop` off plays the sequence once and holds on the final line, which is what
 * the onboarding wants: an entity finishing a thought, not a carousel.
 */

/**
 * Blur is expressed in px, so it has to be sized against the type it is applied
 * to. The reference implementation used 8px against 40pt display text, where a
 * glyph stem is far wider than the blur; at UI sizes the same number dissolves
 * letters completely before they reform, which reads as a fade-out followed by
 * a fade-in rather than one word becoming another.
 */
const DEFAULT_BLUR_PX = 4;

function useMorphingText(
  texts: string[],
  loop: boolean,
  morphSeconds: number,
  holdSeconds: number,
  blurPx: number,
  onSettled?: () => void
) {
  const textIndexRef = React.useRef(0);
  const morphRef = React.useRef(0);
  const cooldownRef = React.useRef(0);
  const timeRef = React.useRef(Date.now());
  const finishedRef = React.useRef(false);

  const text1Ref = React.useRef<HTMLSpanElement>(null);
  const text2Ref = React.useRef<HTMLSpanElement>(null);

  const settledRef = React.useRef(onSettled);
  settledRef.current = onSettled;

  const setStyles = React.useCallback(
    (fraction: number) => {
      const current1 = text1Ref.current;
      const current2 = text2Ref.current;
      if (!current1 || !current2) return;

      // Capped well below the reference's 100px: past roughly a glyph's width
      // the letterforms stop being recoverable and the threshold has nothing to
      // re-harden, which is what turns a morph into a blink.
      const cap = blurPx * 3;
      current2.style.filter = `blur(${Math.min(blurPx / fraction - blurPx, cap)}px)`;
      current2.style.opacity = `${Math.pow(fraction, 0.4) * 100}%`;

      const inverted = 1 - fraction;
      current1.style.filter = `blur(${Math.min(blurPx / inverted - blurPx, cap)}px)`;
      current1.style.opacity = `${Math.pow(inverted, 0.4) * 100}%`;

      current1.textContent = texts[textIndexRef.current % texts.length];
      current2.textContent = texts[(textIndexRef.current + 1) % texts.length];
    },
    [texts, blurPx]
  );

  React.useEffect(() => {
    // Reset when the sequence itself changes, so a new line starts cleanly.
    textIndexRef.current = 0;
    morphRef.current = 0;
    cooldownRef.current = 0;
    finishedRef.current = false;
    timeRef.current = Date.now();

    // A single line has nothing to morph into — show it and stop.
    if (texts.length <= 1) {
      const el = text2Ref.current;
      if (el) {
        el.textContent = texts[0] ?? "";
        el.style.filter = "none";
        el.style.opacity = "100%";
      }
      if (text1Ref.current) text1Ref.current.style.opacity = "0%";
      settledRef.current?.();
      return;
    }

    // The first line starts morphing on frame one otherwise, so it is on screen
    // for a fraction of the time every later line gets. Hold it first.
    let initialHold = holdSeconds;
    let seeded = false;

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);

      const now = Date.now();
      const dt = (now - timeRef.current) / 1000;
      timeRef.current = now;

      if (initialHold > 0) {
        if (!seeded) {
          // fraction 0 paints line one at full strength, line two invisible.
          setStyles(0);
          seeded = true;
        }
        initialHold -= dt;
        return;
      }

      cooldownRef.current -= dt;

      if (cooldownRef.current > 0) {
        // Holding on a fully-formed line.
        morphRef.current = 0;
        const c1 = text1Ref.current;
        const c2 = text2Ref.current;
        if (c1 && c2) {
          c2.style.filter = "none";
          c2.style.opacity = "100%";
          c1.style.filter = "none";
          c1.style.opacity = "0%";
        }
        return;
      }

      // Reached the end of a one-shot sequence: hold the last line forever.
      if (!loop && textIndexRef.current >= texts.length - 1) {
        if (!finishedRef.current) {
          finishedRef.current = true;
          settledRef.current?.();
        }
        cancelAnimationFrame(raf);
        return;
      }

      morphRef.current += dt;
      let fraction = morphRef.current / morphSeconds;
      if (fraction >= 1) {
        cooldownRef.current = holdSeconds;
        fraction = 1;
      }
      setStyles(fraction);
      if (fraction === 1) textIndexRef.current += 1;
    };

    animate();
    return () => cancelAnimationFrame(raf);
  }, [texts, loop, morphSeconds, holdSeconds, setStyles]);

  return { text1Ref, text2Ref };
}

/**
 * The threshold filter that re-hardens the blurred edges. Rendered once per
 * instance with a unique id so multiple morphing lines can coexist.
 */
function ThresholdFilter({ id }: { id: string }) {
  return (
    <svg
      aria-hidden
      focusable="false"
      // Rendered as a *sibling* of the filtered element, never inside it, and
      // given real dimensions rather than size-0. A filter defined within the
      // element it filters, or inside a zero-sized SVG, can fail to resolve —
      // and an unresolved filter reference makes the element not render at all,
      // which is a blank screen rather than a degraded one.
      style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", opacity: 0 }}
    >
      <defs>
        <filter id={id}>
          <feColorMatrix
            in="SourceGraphic"
            type="matrix"
            values="1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    0 0 0 255 -140"
          />
        </filter>
      </defs>
    </svg>
  );
}

export function MorphingText({
  texts,
  className,
  loop = true,
  onSettled,
  morphSeconds = 2.4,
  holdSeconds = 1.8,
  blurPx = DEFAULT_BLUR_PX,
  as: Tag = "div",
}: {
  texts: string[];
  className?: string;
  /** Off: play through once and hold the last line. */
  loop?: boolean;
  /** Fires when a one-shot sequence reaches its final line. */
  onSettled?: () => void;
  /** Seconds spent melting one line into the next. */
  morphSeconds?: number;
  /** Seconds a fully-formed line is held before the next morph starts. */
  holdSeconds?: number;
  /** Peak blur. Scale to the type size — see DEFAULT_BLUR_PX. */
  blurPx?: number;
  as?: "div" | "h1" | "h2" | "p";
}) {
  const filterId = React.useId().replace(/:/g, "");
  const { text1Ref, text2Ref } = useMorphingText(
    texts,
    loop,
    morphSeconds,
    holdSeconds,
    blurPx,
    onSettled
  );

  // A single line never morphs, so it needs no threshold.
  const wantsFilter = texts.length > 1;

  /*
   * Only reference the filter once its <defs> are confirmed present.
   *
   * An unresolved `filter: url(#id)` does not degrade — the element stops
   * rendering entirely, which is a blank panel rather than an unstyled one.
   * The first paint therefore goes out without the filter, and it is attached
   * on the next tick if (and only if) the definition really exists. Worst case
   * the morph reads as a soft crossfade instead of a melt; it can never take
   * the text with it.
   */
  const [filterReady, setFilterReady] = React.useState(false);
  React.useEffect(() => {
    if (!wantsFilter) return;
    setFilterReady(Boolean(document.getElementById(filterId)));
  }, [wantsFilter, filterId]);

  const morphs = wantsFilter && filterReady;

  return (
    <>
      {/* Always rendered when a morph is wanted, so the effect above has
          something to find. Only the *reference* is deferred. */}
      {wantsFilter ? <ThresholdFilter id={filterId} /> : null}
      <Tag
        className={cn("relative w-full", className)}
        style={morphs ? { filter: `url(#${filterId}) blur(0.3px)` } : undefined}
      >
        {/* The live text for assistive tech — the spans below are visual only,
            and their content is swapped every frame mid-morph. */}
        <span className="sr-only">{texts[texts.length - 1]}</span>
        <span aria-hidden ref={text1Ref} className="absolute inset-0 inline-block w-full" />
        <span aria-hidden ref={text2Ref} className="absolute inset-0 inline-block w-full" />
      </Tag>
    </>
  );
}
