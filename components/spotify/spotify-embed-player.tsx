"use client";

import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

type SpotifyEmbedPlayerProps = {
  trackTitle: string;
  spotifyTrackId?: string | null;
  spotifyUrl?: string | null;
  explainBounce?: boolean;
  className?: string;
};

export function resolveSpotifyTrackId(
  spotifyTrackId?: string | null,
  spotifyUrl?: string | null
): string | null {
  return spotifyTrackId?.match(/^[A-Za-z0-9]{10,40}$/)?.[0]
    ?? spotifyUrl?.match(/open\.spotify\.com\/track\/([A-Za-z0-9]+)/i)?.[1]
    ?? null;
}

export function SpotifyEmbedPlayer({
  trackTitle,
  spotifyTrackId,
  spotifyUrl,
  explainBounce = false,
  className,
}: SpotifyEmbedPlayerProps) {
  const spotifyId = resolveSpotifyTrackId(spotifyTrackId, spotifyUrl);
  if (!spotifyId) return null;

  const canonicalUrl = spotifyUrl ?? `https://open.spotify.com/track/${spotifyId}`;
  const embedUrl = `https://open.spotify.com/embed/track/${encodeURIComponent(spotifyId)}?utm_source=tempo`;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full bg-[#1DB954]/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[#53db83]">
          Spotify playback
        </span>
        <a
          href={canonicalUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-xs text-text-lo transition-colors duration-hover hover:text-ice"
        >
          Open in Spotify
          <ExternalLink className="size-3.5" />
        </a>
      </div>
      <iframe
        title={`Spotify player for ${trackTitle}`}
        src={embedUrl}
        width="100%"
        height="152"
        loading="lazy"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        className="block w-full rounded-card border-0 bg-bg-2"
      />
      {explainBounce ? (
        <p className="text-xs leading-relaxed text-text-lo">
          Spotify handles this playback. Upload a bounce whenever you want TEMPO’s waveform,
          timestamped comments, and version tools.
        </p>
      ) : null}
    </div>
  );
}
