"use client";

import Link from "next/link";
import { InfiniteSlider } from "@/components/ui/infinite-slider-horizontal";
import { SpectraCoverArt } from "@/components/spectra/spectra-cover-art";
import type { Track } from "@/lib/types";
import { cn } from "@/lib/utils";

type TrackCoverSliderProps = {
  tracks: Track[];
  className?: string;
};

/**
 * Dual-row infinite marquee of track covers on Today.
 * Covers are links only — no other controls.
 */
export function TrackCoverSlider({ tracks, className }: TrackCoverSliderProps) {
  if (tracks.length === 0) return null;

  // Enough tiles that one marquee half outruns a wide desktop viewport —
  // otherwise the strip looks like it runs out before the seamless loop.
  const MIN_TILES = 12;
  const tiles =
    tracks.length >= MIN_TILES
      ? tracks
      : Array.from(
          { length: Math.ceil(MIN_TILES / tracks.length) },
          () => tracks,
        ).flat();

  return (
    <div
      className={cn("relative -mx-1 overflow-hidden py-1", className)}
      style={{
        maskImage:
          "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
      }}
    >
      <div className="flex flex-col gap-4">
        <InfiniteSlider
          direction="horizontal"
          gap={14}
          duration={110}
          durationOnHover={180}
        >
          {tiles.map((track, i) => (
            <CoverTile key={`a-${track.id}-${i}`} track={track} />
          ))}
        </InfiniteSlider>
        <InfiniteSlider
          direction="horizontal"
          reverse
          gap={14}
          duration={125}
          durationOnHover={200}
        >
          {tiles.map((track, i) => (
            <CoverTile key={`b-${track.id}-${i}`} track={track} />
          ))}
        </InfiniteSlider>
      </div>
    </div>
  );
}

function CoverTile({ track }: { track: Track }) {
  return (
    <Link
      href={`/track/${track.id}`}
      className="group relative block aspect-square w-[148px] shrink-0 overflow-hidden rounded-card border border-line/60 shadow-e1 opacity-[0.55] transition-[opacity,border-color,box-shadow,transform] duration-300 ease-out hover:z-10 hover:scale-[1.02] hover:border-ice/40 hover:opacity-100 hover:shadow-e2 focus-visible:z-10 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice sm:w-[168px]"
      aria-label={`Open ${track.title}`}
      title={track.title}
    >
      <SpectraCoverArt
        trackId={track.id}
        title={track.title}
        artworkUrl={track.artwork_url}
        showTitle
      />
    </Link>
  );
}
