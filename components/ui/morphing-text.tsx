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

const MORPH_SECONDS = 1.5;
const COOLDOWN_SECONDS = 0.6;

function useMorphingText(
  texts: string[],
  loop: boolean,
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

      current2.style.filter = `blur(${Math.min(8 / fraction - 8, 100)}px)`;
      current2.style.opacity = `${Math.pow(fraction, 0.4) * 100}%`;

      const inverted = 1 - fraction;
      current1.style.filter = `blur(${Math.min(8 / inverted - 8, 100)}px)`;
      current1.style.opacity = `${Math.pow(inverted, 0.4) * 100}%`;

      current1.textContent = texts[textIndexRef.current % texts.length];
      current2.textContent = texts[(textIndexRef.current + 1) % texts.length];
    },
    [texts]
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

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);

      const now = Date.now();
      const dt = (now - timeRef.current) / 1000;
      timeRef.current = now;
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
      let fraction = morphRef.current / MORPH_SECONDS;
      if (fraction >= 1) {
        cooldownRef.current = COOLDOWN_SECONDS;
        fraction = 1;
      }
      setStyles(fraction);
      if (fraction === 1) textIndexRef.current += 1;
    };

    animate();
    return () => cancelAnimationFrame(raf);
  }, [texts, loop, setStyles]);

  return { text1Ref, text2Ref };
}

/**
 * The threshold filter that re-hardens the blurred edges. Rendered once per
 * instance with a unique id so multiple morphing lines can coexist.
 */
function ThresholdFilter({ id }: { id: string }) {
  return (
    <svg className="absolute size-0" aria-hidden focusable="false">
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
  as: Tag = "div",
}: {
  texts: string[];
  className?: string;
  /** Off: play through once and hold the last line. */
  loop?: boolean;
  /** Fires when a one-shot sequence reaches its final line. */
  onSettled?: () => void;
  as?: "div" | "h1" | "h2" | "p";
}) {
  const filterId = React.useId().replace(/:/g, "");
  const { text1Ref, text2Ref } = useMorphingText(texts, loop, onSettled);

  return (
    <Tag
      className={cn("relative w-full", className)}
      style={{ filter: `url(#${filterId}) blur(0.4px)` }}
    >
      {/* The live text for assistive tech — the spans below are visual only,
          and their content is swapped every frame mid-morph. */}
      <span className="sr-only">{texts[texts.length - 1]}</span>
      <span aria-hidden ref={text1Ref} className="absolute inset-0 inline-block w-full" />
      <span aria-hidden ref={text2Ref} className="absolute inset-0 inline-block w-full" />
      <ThresholdFilter id={filterId} />
    </Tag>
  );
}
