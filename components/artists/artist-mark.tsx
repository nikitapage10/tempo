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
  /** Profile photo or emblem — falls back to palette bars when null. */
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
          "aspect-square shrink-0 rounded-full border border-line bg-bg-2 object-cover",
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

/**
 * A profile-header treatment that lets the identity image dissolve into the
 * artist banner instead of reading like a standard avatar chip.
 */
export function ArtistProfileImage({
  emblemUrl,
  paletteId,
  iceColor,
  amberColor,
  name,
  className,
}: {
  emblemUrl: string | null;
  paletteId: string | null | undefined;
  iceColor?: string | null;
  amberColor?: string | null;
  name: string;
  className?: string;
}) {
  const { ice, amber } = resolveArtistAccent(paletteId, {
    ice: iceColor,
    amber: amberColor,
  });

  return (
    <span
      className={cn(
        "relative isolate flex size-[72px] shrink-0 items-center justify-center sm:size-20",
        className
      )}
    >
      <span
        aria-hidden
        className="absolute inset-[14%] -z-10 rounded-full opacity-45 blur-xl"
        style={{
          background: `linear-gradient(135deg, ${ice}, ${amber})`,
        }}
      />
      <span
        className="relative block size-full [mask-image:radial-gradient(circle_at_50%_48%,#000_44%,rgba(0,0,0,0.94)_58%,transparent_78%)]"
      >
        <ArtistMark
          emblemUrl={emblemUrl}
          paletteId={paletteId}
          iceColor={iceColor}
          amberColor={amberColor}
          name={name}
          size={72}
          className="size-full scale-110 border-0"
        />
      </span>
      <span
        aria-hidden
        className="absolute -bottom-1 left-1/2 h-px w-[72%] -translate-x-1/2 opacity-60"
        style={{
          background: `linear-gradient(90deg, transparent, ${ice}, #fff, ${amber}, transparent)`,
        }}
      />
    </span>
  );
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
      className={cn(
        "flex shrink-0 items-center justify-center gap-[2px] overflow-hidden rounded-full border border-line bg-bg-2",
        className
      )}
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
