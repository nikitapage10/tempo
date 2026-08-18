"use client";

import * as React from "react";
import { useReducedMotion, type Transition } from "framer-motion";

/** Shared spring for cards sliding between Kanban-style columns. */
export const LAYOUT_MOVE_TRANSITION: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 40,
  mass: 0.75,
};

/**
 * FLIP props for an item that can move between columns. Disabled for drag
 * overlays (those are cursor clones) and when the user prefers reduced motion.
 */
export function useLayoutMove(id: string, enabled = true) {
  const reduce = useReducedMotion();
  const animate = enabled && reduce !== true;
  return {
    initial: false,
    layout: animate ? ("position" as const) : false,
    layoutId: animate ? id : undefined,
    transition: animate ? LAYOUT_MOVE_TRANSITION : { duration: 0 },
  };
}

/**
 * Keep clipping off for a beat after drop so the sliding card isn't cut off
 * by column overflow while it travels.
 */
export function useLayoutOverflowUnlock(active: boolean, holdMs = 560) {
  const [held, setHeld] = React.useState(false);
  const seen = React.useRef(false);

  React.useEffect(() => {
    if (active) {
      seen.current = true;
      setHeld(true);
      return;
    }
    if (!seen.current) return;
    const timer = window.setTimeout(() => setHeld(false), holdMs);
    return () => window.clearTimeout(timer);
  }, [active, holdMs]);

  return active || held;
}
