"use client";

import Link from "next/link";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useGlobalPlayer } from "@/components/player/global-player-provider";
import { SpectraCoverArt } from "@/components/spectra/spectra-cover-art";
import { SlitDivider } from "@/components/ui/slit";

/** Bottom-of-rail "now playing" strip — only renders once something has been played this session. */
export function GlobalPlayerBar() {
  const { current, playing, loading, toggle, next, prev } = useGlobalPlayer();

  if (!current) return null;

  return (
    <div className="px-1.5 pb-3 min-[960px]:px-3">
      <SlitDivider className="mb-2.5" />
      <Link
        href={`/track/${current.id}`}
        title={current.title}
        className="flex flex-col items-center gap-1.5 rounded-input px-1 py-1 text-center transition-colors duration-hover hover:bg-bg-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
      >
        <span className="relative size-11 shrink-0 overflow-hidden rounded-input border border-line shadow-e1 min-[960px]:size-28">
          <SpectraCoverArt
            trackId={current.id}
            title={current.title}
            artworkUrl={current.artworkUrl}
            animate={false}
          />
        </span>
        <div className="hidden min-w-0 w-full min-[960px]:block">
          <p className="truncate text-xs font-medium text-text-hi">{current.title}</p>
          <p className="truncate text-xs text-text-lo">{current.artist ?? "—"}</p>
        </div>
      </Link>

      <div className="mt-2 flex flex-col items-center gap-2 min-[960px]:mt-2.5 min-[960px]:flex-row min-[960px]:justify-center min-[960px]:gap-4">
        <button
          type="button"
          aria-label="Previous track"
          onClick={prev}
          className="hidden text-text-lo transition-colors duration-hover hover:text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice min-[960px]:inline-flex"
        >
          <SkipBack className="size-4" fill="currentColor" />
        </button>
        <button
          type="button"
          aria-label={playing ? "Pause" : "Play"}
          onClick={toggle}
          disabled={loading}
          className="flex size-9 items-center justify-center rounded-full bg-ice text-bg-0 transition-opacity duration-hover hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice min-[960px]:size-8"
        >
          {playing ? (
            <Pause className="size-4" fill="currentColor" />
          ) : (
            <Play className="size-4 translate-x-px" fill="currentColor" />
          )}
        </button>
        <button
          type="button"
          aria-label="Next track"
          onClick={next}
          className="hidden text-text-lo transition-colors duration-hover hover:text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice min-[960px]:inline-flex"
        >
          <SkipForward className="size-4" fill="currentColor" />
        </button>
      </div>
    </div>
  );
}
