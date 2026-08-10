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
  const isPresidentWordmark = emblemUrl === "/demo/president/logo.webp";
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
          isPresidentWordmark && "bg-black object-contain p-[8%]",
          className
        )}
        fallback={<MonogramMark ice={ice} amber={amber} name={name} size={size} className={className} />}
      />
    );
  }

  return <MonogramMark ice={ice} amber={amber} name={name} size={size} className={className} />;
}

const PROFILE_IMAGE_MASK = [
  "linear-gradient(to right, transparent 0%, rgb(0 0 0 / 0.5) 14%, #000 36%, #000 66%, rgb(0 0 0 / 0.45) 88%, transparent 100%)",
  "linear-gradient(to bottom, #000 0%, #000 54%, rgb(0 0 0 / 0.6) 80%, transparent 100%)",
].join(", ");

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
  const isPresidentWordmark = emblemUrl === "/demo/president/logo.webp";
  const { ice, amber } = resolveArtistAccent(paletteId, {
    ice: iceColor,
    amber: amberColor,
  });

  return (
    <span
      className={cn(
        "pointer-events-none relative isolate flex h-full items-center justify-center",
        className
      )}
    >
      <span
        aria-hidden
        className="absolute inset-[16%] -z-10 rounded-full opacity-25 blur-3xl"
        style={{
          background: `linear-gradient(135deg, ${ice}, ${amber})`,
        }}
      />
      <span
        className="absolute inset-x-0 -top-[3%] bottom-0"
        style={{
          // Two linear fades intersected: the image fills its box edge to edge,
          // so the feather lands on the photo itself rather than on empty
          // letterbox space, and it dissolves into the banner on every side.
          WebkitMaskImage: PROFILE_IMAGE_MASK,
          maskImage: PROFILE_IMAGE_MASK,
          WebkitMaskComposite: "source-in",
          maskComposite: "intersect",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskSize: "100% 100%",
          maskSize: "100% 100%",
          ...(isPresidentWordmark
            ? {
                WebkitMaskImage: "none",
                maskImage: "none",
              }
            : {}),
        }}
      >
        <SignedImage
          path={emblemUrl}
          alt={name}
          className={cn(
            "size-full object-cover object-[50%_18%]",
            isPresidentWordmark && "object-contain"
          )}
        />
      </span>
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
        width: className ? undefined : size,
        height: className ? undefined : size,
        background: `radial-gradient(circle at 30% 24%, color-mix(in srgb, ${ice} 26%, transparent) 0%, transparent 44%), radial-gradient(circle at 76% 80%, color-mix(in srgb, ${amber} 20%, transparent) 0%, transparent 48%), linear-gradient(145deg, #24242d 0%, #111116 100%)`,
        boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.07), inset 0 -8px 18px rgb(0 0 0 / 0.26)",
      }}
      role="img"
      aria-label={name}
    >
      <span
        aria-hidden
        className="absolute inset-[7%] rounded-full opacity-70"
        style={{
          background: `conic-gradient(from 215deg, transparent 0deg 58deg, ${ice} 78deg, transparent 102deg 226deg, ${amber} 246deg, transparent 270deg 360deg)`,
          WebkitMaskImage: "radial-gradient(circle, transparent 64%, #000 68%)",
          maskImage: "radial-gradient(circle, transparent 64%, #000 68%)",
        }}
      />
      <span aria-hidden className="absolute inset-[18%] rounded-full border border-white/[0.07]" />
      <span aria-hidden className="absolute inset-[31%] rounded-full border border-white/[0.04]" />
      <span
        className="relative font-display font-semibold leading-none tracking-[-0.04em] text-white/85"
        style={{
          fontSize: Math.max(8, Math.round(size * 0.34)),
          textShadow: "0 1px 8px rgb(0 0 0 / 0.7)",
        }}
      >
        {initials}
      </span>
      <span
        aria-hidden
        className="absolute right-[16%] top-[14%] rounded-full"
        style={{
          width: Math.max(2, Math.round(size * 0.08)),
          height: Math.max(2, Math.round(size * 0.08)),
          background: ice,
          boxShadow: `0 0 ${Math.max(4, Math.round(size * 0.18))}px ${ice}`,
        }}
      />
    </span>
  );
}
