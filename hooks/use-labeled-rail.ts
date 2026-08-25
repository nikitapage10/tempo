"use client";

import * as React from "react";

/** Match Tailwind `lg`: ordinary desktop windows should keep readable labels. */
const LABELED_RAIL_MQ = "(min-width: 1024px)";

export function useLabeledRail(): boolean {
  const [labeled, setLabeled] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(LABELED_RAIL_MQ).matches;
  });

  React.useEffect(() => {
    const mq = window.matchMedia(LABELED_RAIL_MQ);
    const apply = () => setLabeled(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return labeled;
}
