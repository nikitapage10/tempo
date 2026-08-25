"use client";

import * as React from "react";
import Link from "next/link";
import { Pause, Play } from "lucide-react";
import {
  useGlobalPlayer,
  type PlayerTrack,
} from "@/components/player/global-player-provider";
import { SpectraCoverArt } from "@/components/spectra/spectra-cover-art";
import {
  resolveSpotifyTrackId,
  SpotifyEmbedPlayer,
} from "@/components/spotify/spotify-embed-player";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { InfiniteSlider } from "@/components/ui/infinite-slider-horizontal";
import { LfWindow } from "@/components/lf-windows";
import { useVersionsForTracks } from "@/hooks/use-versions";
import type { Track } from "@/lib/types";
import { cn } from "@/lib/utils";

type TrackCoverSliderProps = {
  tracks: Track[];
  className?: string;
};

/**
 * One restrained reel of the current catalog. Artwork stays secondary to the
 * Today hero; the cover plays and its title strip opens the track workspace.
 */
export function TrackCoverSlider({ tracks, className }: TrackCoverSliderProps) {
  const versionsQuery = useVersionsForTracks(tracks.map((track) => track.id));
  const { current, playing, play, toggle } = useGlobalPlayer();
  const [spotifyTrack, setSpotifyTrack] = React.useState<Track | null>(null);

  const playableTracks = React.useMemo(() => {
    const map = new Map<string, PlayerTrack>();
    const versionsByTrack = versionsQuery.data;
    if (!versionsByTrack) return map;
    for (const track of tracks) {
      const versions = versionsByTrack.get(track.id);
      if (!versions?.length) continue;
      const version = versions.find((item) => item.is_current) ?? versions[0];
      map.set(track.id, {
        id: track.id,
        title: track.title,
        artist: track.artist_alias,
        artworkUrl: track.artwork_url,
        fileUrl: version.file_url,
      });
    }
    return map;
  }, [tracks, versionsQuery.data]);

  const playableQueue = React.useMemo(
    () =>
      tracks
        .map((track) => playableTracks.get(track.id))
        .filter((track): track is PlayerTrack => !!track),
    [playableTracks, tracks]
  );

  function handlePlay(track: Track) {
    const playerTrack = playableTracks.get(track.id);
    if (!playerTrack) {
      if (resolveSpotifyTrackId(track.spotify_track_id, track.spotify_url)) {
        setSpotifyTrack(track);
      }
      return;
    }
    if (current?.id === track.id) {
      toggle();
      return;
    }
    play(playerTrack, playableQueue);
  }

  // Cap how many covers the marquee ever renders — large catalogs (hundreds
  // of imported tracks) otherwise blow up DOM size and the fixed-duration
  // CSS animation ends up looking like it's "sliding too fast". A fresh
  // random sample keeps it feeling alive across visits without re-rendering
  // every track in the space.
  const SLIDER_CAP = 30;
  const sample = React.useMemo(() => {
    if (tracks.length <= SLIDER_CAP) return tracks;
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, SLIDER_CAP);
  }, [tracks]);

  if (tracks.length === 0) return null;

  // Enough tiles that one marquee half outruns a wide desktop viewport.
  const MIN_TILES = 12;
  const tiles =
    sample.length >= MIN_TILES
      ? sample
      : Array.from(
          { length: Math.ceil(MIN_TILES / sample.length) },
          () => sample
        ).flat();

  return (
    <>
      <section className={cn("relative", className)} aria-labelledby="studio-reel-heading">
        <div className="mb-3 flex items-center gap-3 px-1">
          <h2 id="studio-reel-heading" className="label-mono shrink-0">
            In your studio
          </h2>
          <span className="font-data text-[11px] tabular-nums text-text-lo/60">
            {tracks.length}
          </span>
          <LfWindow className="h-px flex-1 opacity-70" aria-hidden />
        </div>
        <div
          className="today-studio-reel relative -mx-1 overflow-hidden py-2"
          style={{
            maskImage:
              "linear-gradient(to right, transparent, black 7%, black 93%, transparent)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent, black 7%, black 93%, transparent)",
          }}
        >
          <InfiniteSlider
            direction="horizontal"
            gap={18}
            duration={155}
            durationOnHover={560}
          >
            {tiles.map((track, index) => (
              <CoverTile
                key={`${track.id}-${index}`}
                track={track}
                source={
                  playableTracks.has(track.id)
                    ? "bounce"
                    : resolveSpotifyTrackId(
                          track.spotify_track_id,
                          track.spotify_url
                        )
                      ? "spotify"
                      : null
                }
                playing={current?.id === track.id && playing}
                onPlay={() => handlePlay(track)}
              />
            ))}
          </InfiniteSlider>
        </div>
      </section>
      <Dialog
        open={spotifyTrack != null}
        onOpenChange={(open) => !open && setSpotifyTrack(null)}
        workspaceCentered
      >
        <DialogContent title="Listen on Spotify" className="max-w-xl">
          {spotifyTrack ? (
            <div>
              <p className="label-mono mb-1">Listen on Spotify</p>
              <h2 className="mb-4 font-display text-xl font-semibold text-text-hi">
                {spotifyTrack.title}
              </h2>
              <SpotifyEmbedPlayer
                trackTitle={spotifyTrack.title}
                spotifyTrackId={spotifyTrack.spotify_track_id}
                spotifyUrl={spotifyTrack.spotify_url}
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function CoverTile({
  track,
  source,
  playing,
  onPlay,
}: {
  track: Track;
  source: "bounce" | "spotify" | null;
  playing: boolean;
  onPlay: () => void;
}) {
  const playable = source != null;
  return (
    <article className="group relative aspect-square w-[152px] shrink-0 overflow-hidden rounded-card border border-line/60 shadow-e1 opacity-[0.66] transition-[opacity,border-color,box-shadow,transform] duration-300 ease-out hover:z-10 hover:scale-[1.025] hover:border-ice/40 hover:opacity-100 hover:shadow-e2 focus-within:z-10 focus-within:border-ice/40 focus-within:opacity-100 focus-within:shadow-e2 sm:w-[176px]">
      <SpectraCoverArt
        trackId={track.id}
        title={track.title}
        artworkUrl={track.artwork_url}
      />

      <button
        type="button"
        onClick={onPlay}
        disabled={!playable}
        aria-label={
          playable
            ? playing
              ? `Pause ${track.title}`
              : source === "spotify"
                ? `Play ${track.title} on Spotify`
                : `Play ${track.title}`
            : `${track.title} has no playable bounce`
        }
        className="absolute inset-x-0 bottom-14 top-0 z-10 flex items-center justify-center focus-visible:outline-none disabled:cursor-default"
      >
        {source === "spotify" ? (
          <span className="absolute right-2 top-2 rounded-full bg-[#1DB954] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-black shadow-e1">
            Spotify
          </span>
        ) : null}
        <span
          className={cn(
            "flex size-11 items-center justify-center rounded-full bg-black/75 text-white shadow-e2 backdrop-blur-sm transition-[opacity,transform] duration-200",
            playing
              ? "scale-100 opacity-100"
              : "scale-100 opacity-90 sm:scale-90 sm:opacity-0 sm:group-hover:scale-100 sm:group-hover:opacity-100 sm:group-focus-within:scale-100 sm:group-focus-within:opacity-100",
            !playable && "hidden"
          )}
        >
          {playing ? (
            <Pause className="size-5" fill="currentColor" />
          ) : (
            <Play className="size-5 translate-x-px" fill="currentColor" />
          )}
        </span>
      </button>

      <Link
        href={`/track/${track.id}`}
        className="absolute inset-x-0 bottom-0 z-20 flex min-h-16 flex-col justify-end bg-gradient-to-t from-black via-black/80 to-transparent px-3 pb-2.5 pt-8 text-white opacity-100 transition-opacity duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ice sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 sm:focus-visible:opacity-100"
        aria-label={`Open ${track.title}`}
      >
        <span className="truncate text-xs font-medium">{track.title}</span>
        <span className="truncate text-[11px] text-white/65">
          {track.artist_alias || "Open track"}
        </span>
      </Link>
    </article>
  );
}
