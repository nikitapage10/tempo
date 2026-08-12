"use client";

import * as React from "react";

/** Tailwind `xl` is 1280px — labeled rail vs compact icon rail. */
const LABELED_RAIL_MQ = "(min-width: 1280px)";

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
