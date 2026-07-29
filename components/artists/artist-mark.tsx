"use client";

import { SignedImage } from "@/components/ui/signed-image";
import { resolveArtistAccent } from "@/lib/artist-theme";
import { cn } from "@/lib/utils";

/**
 * An artist's chip-size identity: their uploaded logo, or — when they have
 * none — a miniature of the wordmark's bar cluster in their own palette.
 *
 * The fallback deliberately reuses the product's bar motif rather than an
 * initial or a generic avatar, so an artist without a logo still looks like
 * they belong in TEMPO.
 */

/** height (0–1) and width in px — the wordmark's silhouette, shortened. */
const BARS: { h: number; w: number; o: number }[] = [
  { h: 0.55, w: 1, o: 0.7 },
  { h: 1.0, w: 1.5, o: 1 },
  { h: 0.75, w: 1, o: 0.85 },
  { h: 0.4, w: 1, o: 0.5 },
];

export function ArtistMark({
  emblemUrl,
  paletteId,
  iceColor,
  amberColor,
  name,
  size = 18,
  className,
}: {
  /** Square identity image — falls back to palette bars when null. */
  emblemUrl: string | null;
  paletteId: string | null | undefined;
  iceColor?: string | null;
  amberColor?: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const { ice, amber } = resolveArtistAccent(paletteId, {
    ice: iceColor,
    amber: amberColor,
  });
  const ramp = `linear-gradient(180deg, ${ice} 0%, #ffffff 50%, ${amber} 100%)`;

  if (emblemUrl) {
    return (
      <SignedImage
        path={emblemUrl}
        alt={name}
        className={cn(
          "shrink-0 rounded-[4px] object-cover aspect-square",
          className
        )}
        fallback={
          <BarMark ramp={ramp} size={size} className={className} />
        }
      />
    );
  }

  return <BarMark ramp={ramp} size={size} className={className} />;
}

function BarMark({
  ramp,
  size,
  className,
}: {
  ramp: string;
  size: number;
  className?: string;
}) {
  return (
    <span
      className={cn("flex shrink-0 items-center gap-[2px]", className)}
      style={{ height: size }}
      aria-hidden
    >
      {BARS.map((bar, i) => (
        <span
          key={i}
          className="rounded-full"
          style={{
            width: bar.w,
            height: `${bar.h * 100}%`,
            background: ramp,
            opacity: bar.o,
          }}
        />
      ))}
    </span>
  );
}
