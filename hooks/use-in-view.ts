"use client";

import * as React from "react";

/**
 * Minimal "has this element entered the viewport yet" hook — the one thing
 * pulled from react-intersection-observer for the team constellation
 * animation. Native IntersectionObserver covers the entire need in ~15
 * lines, so this stays dependency-free rather than adding a package for a
 * single boolean.
 */
export function useInView<T extends HTMLElement>(
  options: { threshold?: number; triggerOnce?: boolean } = {}
): [React.RefObject<T>, boolean] {
  const { threshold = 0.2, triggerOnce = true } = options;
  const ref = React.useRef<T>(null);
  const [inView, setInView] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (triggerOnce) observer.disconnect();
        } else if (!triggerOnce) {
          setInView(false);
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, triggerOnce]);

  return [ref, inView];
}
