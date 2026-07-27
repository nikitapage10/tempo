"use client";

/**
 * @deprecated Prefer the root `<Lightfield />` (exactly one WebGL context).
 * Kept as a static fallback stub so any leftover import does not spawn WebGL.
 */

import { cn } from "@/lib/utils";

export type ShaderLinesProps = {
  className?: string;
  intensity?: number;
  speed?: number;
};

export function ShaderLines({ className }: ShaderLinesProps) {
  return (
    <div className={cn("flare-static h-full w-full", className)} aria-hidden />
  );
}
