"use client";

import * as React from "react";
import { useActiveArtist } from "@/components/active-artist-provider";
import { ArtistMark } from "@/components/artists/artist-mark";

/** Typing indicator dot. Respects reduced motion via the animate-pulse utility. */
export function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="size-1.5 animate-pulse rounded-full bg-text-lo motion-reduce:animate-none"
      style={{ animationDelay: delay }}
    />
  );
}

/** One message in a TEMPO ↔ artist transcript. */
export function Bubble({
  from,
  children,
}: {
  from: "tempo" | "artist";
  children: React.ReactNode;
}) {
  const isArtist = from === "artist";
  const { activeArtist } = useActiveArtist();

  if (isArtist) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-card rounded-br-sm border border-ice/30 bg-gradient-to-br from-ice/15 to-ice/5 px-4 py-3 shadow-e1">
          {children}
        </div>
      </div>
    );
  }

  // TEMPO speaks wearing the active artist's emblem beside it (their own
  // bar-cluster mark when no emblem is uploaded), so the two voices are
  // distinguishable at a glance rather than by alignment alone.
  return (
    <div className="flex gap-3">
      <span
        aria-hidden
        className="mt-0.5 flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-bg-2 shadow-e1"
      >
        {activeArtist ? (
          <ArtistMark
            emblemUrl={activeArtist.emblem_url}
            paletteId={activeArtist.palette_id}
            iceColor={activeArtist.ice_color}
            amberColor={activeArtist.amber_color}
            name={activeArtist.name}
            size={28}
            className="size-7"
          />
        ) : (
          <span className="block size-3 rounded-full bg-gradient-to-br from-ice via-white to-amber" />
        )}
      </span>
      <div className="min-w-0 max-w-[85%] rounded-card rounded-tl-sm border border-line bg-bg-2/80 px-4 py-3 shadow-e1">
        {children}
      </div>
    </div>
  );
}
