"use client";

import { SignedImage } from "@/components/ui/signed-image";
import { resolveArtistAccent } from "@/lib/artist-theme";
import { cn } from "@/lib/utils";

/** An artist's compact identity image, with a palette monogram fallback. */
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
  if (emblemUrl) {
    return (
      <SignedImage
        path={emblemUrl}
        alt={name}
        className={cn(
          "aspect-square shrink-0 rounded-full border border-line bg-bg-2 object-cover",
          className
        )}
        fallback={<MonogramMark ice={ice} amber={amber} name={name} size={size} className={className} />}
      />
    );
  }

  return <MonogramMark ice={ice} amber={amber} name={name} size={size} className={className} />;
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

function MonogramMark({
  ice,
  amber,
  name,
  size,
  className,
}: {
  ice: string;
  amber: string;
  name: string;
  size: number;
  className?: string;
}) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?";

  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 text-white shadow-e1",
        className
      )}
      style={{
        height: size,
        background: `radial-gradient(circle at 28% 22%, color-mix(in srgb, ${ice} 72%, white) 0%, transparent 34%), linear-gradient(145deg, color-mix(in srgb, ${ice} 38%, var(--bg-2)) 0%, var(--bg-2) 52%, color-mix(in srgb, ${amber} 34%, var(--bg-2)) 100%)`,
      }}
      role="img"
      aria-label={name}
    >
      <span
        aria-hidden
        className="absolute inset-0 opacity-35"
        style={{
          background: `linear-gradient(112deg, transparent 30%, ${ice} 49%, #fff 50%, ${amber} 51%, transparent 70%)`,
        }}
      />
      <span
        className="relative font-display font-semibold leading-none tracking-[-0.04em] text-white/90"
        style={{ fontSize: Math.max(8, Math.round(size * 0.36)) }}
      >
        {initials}
      </span>
    </span>
  );
}
