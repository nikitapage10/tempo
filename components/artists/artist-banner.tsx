"use client";

import { SignedImage } from "@/components/ui/signed-image";
import type { Artist } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * An artist's banner, as a background layer inside existing chrome.
 *
 * Two rules keep this feeling like TEMPO rather than a photo with text on it:
 * images always get a scrim that fades to --bg-0, and flat colours render as
 * a wash toward --bg-0 rather than a flat fill (surfaces here are lit, not
 * painted). With neither set the component renders nothing at all, so the
 * default account is visually untouched.
 */
export function ArtistBanner({
  artist,
  className,
  fadeRight = false,
  children,
}: {
  artist: Pick<Artist, "banner_url" | "banner_color" | "name">;
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
    ? "linear-gradient(100deg, #000 0%, #000 42%, rgb(0 0 0 / 0.55) 62%, transparent 82%)"
    : undefined;

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
            className="absolute inset-0 size-full object-cover"
          />
          {/* Scrim — keeps overlaid text at the same contrast as an unbannered panel. */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgb(10 10 12 / 0.55) 0%, rgb(10 10 12 / 0.75) 60%, var(--bg-0) 100%)",
            }}
          />
        </>
      ) : (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, ${artist.banner_color} 0%, rgb(10 10 12 / 0.65) 70%, var(--bg-0) 100%)`,
          }}
        />
      )}
      {children ? <div className="relative">{children}</div> : null}
    </div>
  );
}
