import type { Momentum, TrackType } from "@/lib/types";

/** Deterministic ice→amber→violet gradient from a track id (artwork placeholder). */
export function gradientFromTrackId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  const h1 = hash % 360;
  const h2 = (hash >> 8) % 360;
  const h3 = (hash >> 16) % 360;
  return `linear-gradient(135deg, hsl(${h1} 55% 28%), hsl(${h2} 45% 18%), hsl(${h3} 50% 22%))`;
}

export function typeChipClass(type: TrackType): string {
  switch (type) {
    case "original":
      return "bg-ice/12 text-ice";
    case "remix":
      return "bg-amber/12 text-amber";
    case "edit":
      return "bg-violet/12 text-violet";
  }
}

export function momentumDotClass(momentum: Momentum): string {
  switch (momentum) {
    case "active":
      return "bg-amber";
    case "simmering":
      return "bg-ice";
    case "stalled":
      return "bg-warn";
    case "parked":
      return "bg-text-lo";
  }
}

export function formatTrackType(type: TrackType): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

/** Maps rows/import drafts created before the three-type taxonomy migration. */
export function normalizeTrackType(type: unknown): TrackType {
  if (type === "remix") return "remix";
  if (type === "edit" || type === "bootleg") return "edit";
  return "original";
}
