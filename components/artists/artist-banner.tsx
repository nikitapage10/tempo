"use client";

import { SignedImage } from "@/components/ui/signed-image";
import type { Artist } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * An artist's banner, as a translucent tint over glass — never a sealed plate.
 * The photo stays light so the video wash and Spectra lines remain visible.
 */
export function ArtistBanner({
  artist,
  className,
  fadeRight = false,
  children,
}: {
  artist: Pick<
    Artist,
    "banner_url" | "banner_color" | "banner_color_end" | "name"
  >;
  className?: string;
  /**
   * Fade the whole layer out toward the right. Used on the Today hero, where
   * the right side is a deliberate opening onto the Spectra lightfield — the
   * banner must not seal it shut.
   */
  fadeRight?: boolean;
  /** Content laid over the banner — sits above the scrim. */
  children?: React.ReactNode;
}) {
  const hasBanner = !!artist.banner_url || !!artist.banner_color;
  if (!hasBanner) return children ? <>{children}</> : null;

  const fadeMask = fadeRight
    ? "linear-gradient(100deg, #000 0%, #000 34%, rgb(0 0 0 / 0.4) 52%, transparent 74%)"
    : undefined;

  const colorWash =
    artist.banner_color && artist.banner_color_end
      ? `linear-gradient(125deg, color-mix(in oklab, ${artist.banner_color} 40%, transparent) 0%, color-mix(in oklab, ${artist.banner_color_end} 28%, transparent) 42%, transparent 100%)`
      : `linear-gradient(180deg, color-mix(in oklab, ${artist.banner_color} 36%, transparent) 0%, transparent 100%)`;

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={
        fadeMask
          ? { maskImage: fadeMask, WebkitMaskImage: fadeMask }
          : undefined
      }
    >
      {artist.banner_url ? (
        <>
          <SignedImage
            path={artist.banner_url}
            alt=""
            className="absolute inset-0 size-full object-cover opacity-[0.22]"
          />
          {/* Soft veil only — no extra blur (that turned Spectra into smoke). */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgb(10 10 12 / 0.12) 0%, rgb(10 10 12 / 0.18) 50%, rgb(10 10 12 / 0.28) 100%)",
            }}
          />
        </>
      ) : (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: colorWash }}
        />
      )}
      {children ? <div className="relative">{children}</div> : null}
    </div>
  );
}
