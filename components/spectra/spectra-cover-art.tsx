"use client";

import * as React from "react";
import { useActiveArtistPalette } from "@/components/active-artist-provider";
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
  // The artist's palette colours the slits, so a catalog of un-arted covers
  // reads as one set. The atmospheric backdrop stays per-track for variety.
  const hues = useActiveArtistPalette();
  const bars = React.useMemo(() => {
    const glyphs = titleToSpectraScore(title);
    return layoutSpectraCoverBars(glyphs, seed, hues) as SpectraBar[];
  }, [title, seed, hues]);
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
          <span className="line-clamp-2 text-xs font-medium leading-snug text-text-hi/90">
            {title}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Soft atmospheric grounds — broad hush palette for distinction.
 * Slits stay ice/white/amber/gray; grounds use a wider spectrum.
 * Gradients fall off slowly so nothing reads as a hard color block.
 */
function backdropBackground(
  style: number,
  angle: number,
  _bias: "ice" | "amber" | "white" | "balanced"
): string {
  // Broad hush accents (RGB triples) — many soft hues for track distinction
  const palette = [
    "127, 180, 255", // ice
    "255, 181, 107", // amber
    "120, 200, 190", // teal
    "220, 150, 170", // rose
    "170, 160, 220", // lilac
    "150, 200, 160", // mint
    "230, 190, 140", // peach
    "140, 160, 210", // soft indigo
    "255, 140, 160", // coral
    "100, 190, 220", // sky
    "200, 170, 120", // sand
    "180, 130, 200", // orchid
    "90, 210, 180", // aqua
    "240, 160, 120", // apricot
    "130, 150, 255", // periwinkle
    "190, 210, 140", // chartreuse hush
    "210, 120, 150", // berry
    "110, 170, 200", // steel blue
    "255, 200, 120", // honey
    "160, 200, 220", // powder
  ] as const;

  const a = palette[style % palette.length];
  const b = palette[(style * 5 + 7) % palette.length];
  const c = palette[(style * 11 + 3) % palette.length];
  const base = "#0a0a0c";

  switch (style % 6) {
    case 0:
      // Soft wash from above (primary + whisper of secondary)
      return `
        radial-gradient(ellipse 140% 90% at 50% -20%, rgba(${a},0.3), rgba(${b},0.1) 38%, transparent 74%),
        linear-gradient(180deg, #0e1016 0%, ${base} 70%)
      `;
    case 1:
      // Soft wash from below
      return `
        radial-gradient(ellipse 130% 95% at 50% 120%, rgba(${a},0.32), rgba(${c},0.1) 40%, transparent 76%),
        linear-gradient(0deg, #12100e 0%, ${base} 70%)
      `;
    case 2:
      // Gentle center haze (tri-blend)
      return `
        radial-gradient(ellipse 90% 75% at 48% 44%, rgba(${a},0.22), rgba(${b},0.1) 40%, rgba(${c},0.06) 58%, transparent 72%),
        linear-gradient(${angle}deg, #0c0c11, ${base} 55%, #0d0d12)
      `;
    case 3:
      // Soft dual side breath
      return `
        radial-gradient(ellipse 70% 100% at 0% 50%, rgba(${a},0.28), transparent 60%),
        radial-gradient(ellipse 70% 100% at 100% 50%, rgba(${b},0.26), transparent 60%),
        ${base}
      `;
    case 4:
      // Soft mid band (very gradual, two–three hues)
      return `
        linear-gradient(
          180deg,
          ${base} 0%,
          ${base} 20%,
          rgba(${a},0.05) 34%,
          rgba(${a},0.22) 46%,
          rgba(${b},0.14) 54%,
          rgba(${c},0.08) 62%,
          rgba(${c},0.03) 70%,
          ${base} 84%,
          ${base} 100%
        )
      `;
    default:
      // Soft corner glow + distant counter-wash + faint third mote
      return `
        radial-gradient(ellipse 90% 80% at 12% 18%, rgba(${a},0.34), rgba(${a},0.1) 36%, transparent 64%),
        radial-gradient(ellipse 80% 70% at 88% 82%, rgba(${b},0.24), transparent 56%),
        radial-gradient(ellipse 50% 40% at 55% 48%, rgba(${c},0.1), transparent 50%),
        linear-gradient(180deg, #0b0b10, ${base})
      `;
  }
}

function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash || 1;
}
