"use client";

import * as React from "react";
import { SignedImage } from "@/components/ui/signed-image";
import {
  layoutSpectraCoverBars,
  spectraFieldProfile,
  titleToSpectraScore,
} from "@/lib/spectra-title-language";
import { cn } from "@/lib/utils";

type SpectraBar = {
  x: number;
  y: number;
  h: number;
  w: number;
  color: string;
  opacity: number;
  delay: string;
  duration: string;
};

type SpectraCoverArtProps = {
  trackId: string;
  title: string;
  artworkUrl?: string | null;
  className?: string;
  /** Show title caption (Today strip). Off for small thumbs. */
  showTitle?: boolean;
  /** Soften animation on dense lists. */
  animate?: boolean;
};

/**
 * Track cover: uploaded art when present, else Spectra Title Language slits
 * over a distinct per-track backdrop (ice / white / amber / gray).
 */
export function SpectraCoverArt({
  trackId,
  title,
  artworkUrl,
  className,
  showTitle = false,
  animate = true,
}: SpectraCoverArtProps) {
  const hasArt = !!artworkUrl;

  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      {!hasArt ? (
        <SpectraPlaceholder
          trackId={trackId}
          title={title}
          showTitle={showTitle}
          animate={animate}
        />
      ) : (
        <SignedImage
          path={artworkUrl}
          alt=""
          className="absolute inset-0 size-full"
        />
      )}
    </div>
  );
}

function SpectraPlaceholder({
  trackId,
  title,
  showTitle,
  animate,
}: {
  trackId: string;
  title: string;
  showTitle: boolean;
  animate: boolean;
}) {
  const seed = hashId(trackId) ^ hashId(title.toLowerCase());
  const bars = React.useMemo(() => {
    const glyphs = titleToSpectraScore(title);
    return layoutSpectraCoverBars(glyphs, seed) as SpectraBar[];
  }, [title, seed]);
  const profile = React.useMemo(() => spectraFieldProfile(seed), [seed]);
  const backdrop = (seed >>> 3) % 6;

  return (
    <div className="spectra-sleeve absolute inset-0 overflow-hidden" aria-hidden>
      {/* Inline background — must not rely on dynamic Tailwind class names */}
      <div
        className="absolute inset-0"
        style={{ background: backdropBackground(backdrop, profile.bgAngle, profile.bgBias) }}
      />

      <div className="spectra-sleeve__field">
        {bars.map((bar, i) => (
          <span
            key={i}
            className={cn(
              "spectra-sleeve__bar",
              !animate && "spectra-sleeve__bar--static"
            )}
            style={
              {
                left: `${bar.x}%`,
                top: `${bar.y}%`,
                width: `${bar.w}%`,
                height: `${bar.h}%`,
                ["--bar-op" as string]: String(bar.opacity * 0.85),
                background: `linear-gradient(
                  to bottom,
                  transparent 0%,
                  ${bar.color}33 12%,
                  ${bar.color}cc 45%,
                  ${bar.color} 50%,
                  ${bar.color}cc 55%,
                  ${bar.color}33 88%,
                  transparent 100%
                )`,
                animationDelay: animate ? bar.delay : undefined,
                animationDuration: animate ? bar.duration : undefined,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {showTitle ? (
        <div className="absolute inset-x-0 bottom-0 z-[1] bg-gradient-to-t from-bg-0/90 via-bg-0/50 to-transparent px-3.5 pb-3 pt-10">
          <span className="line-clamp-2 text-[11px] font-medium leading-snug text-text-hi/90">
            {title}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/** Six quiet Spectra grounds — atmospheric studio light (ice/amber/white/gray). */
function backdropBackground(
  style: number,
  angle: number,
  bias: "ice" | "amber" | "white" | "balanced"
): string {
  const ice = "127, 180, 255";
  const amber = "255, 181, 107";
  const white = "242, 240, 235";
  const gray = "139, 139, 150";

  switch (style % 6) {
    case 0:
      // Cool chamber — ice rim light from above
      return `
        radial-gradient(ellipse 120% 55% at 50% -10%, rgba(${ice},0.35), transparent 55%),
        linear-gradient(180deg, #10141c 0%, #0a0a0c 55%)
      `;
    case 1:
      // Warm chamber — amber floor light
      return `
        radial-gradient(ellipse 110% 60% at 50% 110%, rgba(${amber},0.38), transparent 55%),
        linear-gradient(0deg, #14110c 0%, #0a0a0c 55%)
      `;
    case 2:
      // Soft white well — center haze
      return `
        radial-gradient(ellipse 70% 55% at 50% 45%, rgba(${white},0.22), transparent 65%),
        linear-gradient(${angle}deg, #0c0c10, #0a0a0c 50%, #0e0e12)
      `;
    case 3:
      // Side leak — ice left, amber right (thin, studio-door light)
      return `
        linear-gradient(90deg, rgba(${ice},0.32) 0%, transparent 28%, transparent 72%, rgba(${amber},0.28) 100%),
        #0a0a0c
      `;
    case 4:
      // Gray mist band through the middle
      return `
        linear-gradient(180deg, #0a0a0c 0%, #0a0a0c 30%, rgba(${gray},0.28) 48%, rgba(${gray},0.12) 56%, #0a0a0c 72%, #0a0a0c 100%),
        #0a0a0c
      `;
    default: {
      // Bias-tinted hush — one soft corner glow matching track bias
      const a =
        bias === "amber"
          ? amber
          : bias === "white"
            ? white
            : bias === "ice"
              ? ice
              : gray;
      const pos =
        bias === "amber"
          ? "85% 80%"
          : bias === "white"
            ? "50% 30%"
            : bias === "ice"
              ? "15% 25%"
              : "70% 20%";
      return `
        radial-gradient(circle at ${pos}, rgba(${a},0.4), transparent 42%),
        linear-gradient(180deg, #0b0b0f, #0a0a0c)
      `;
    }
  }
}

function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash || 1;
}
