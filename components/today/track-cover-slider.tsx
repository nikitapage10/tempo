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
import { useVersionsForTracks } from "@/hooks/use-versions";
import type { Track } from "@/lib/types";
import { cn } from "@/lib/utils";

type TrackCoverSliderProps = {
  tracks: Track[];
  className?: string;
};

/**
 * Dual-row infinite marquee of track covers on Today. The artwork plays the
 * current bounce; the revealed title strip opens the track workspace.
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

  if (tracks.length === 0) return null;

  // Enough tiles that one marquee half outruns a wide desktop viewport.
  const MIN_TILES = 12;
  const tiles =
    tracks.length >= MIN_TILES
      ? tracks
      : Array.from(
          { length: Math.ceil(MIN_TILES / tracks.length) },
          () => tracks
        ).flat();

  return (
    <>
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
          durationOnHover={420}
        >
          {tiles.map((track, index) => (
            <CoverTile
              key={`a-${track.id}-${index}`}
              track={track}
              source={
                playableTracks.has(track.id)
                  ? "bounce"
                  : resolveSpotifyTrackId(track.spotify_track_id, track.spotify_url)
                    ? "spotify"
                    : null
              }
              playing={current?.id === track.id && playing}
              onPlay={() => handlePlay(track)}
            />
          ))}
        </InfiniteSlider>
        <InfiniteSlider
          direction="horizontal"
          reverse
          gap={14}
          duration={125}
          durationOnHover={460}
        >
          {tiles.map((track, index) => (
            <CoverTile
              key={`b-${track.id}-${index}`}
              track={track}
              source={
                playableTracks.has(track.id)
                  ? "bounce"
                  : resolveSpotifyTrackId(track.spotify_track_id, track.spotify_url)
                    ? "spotify"
                    : null
              }
              playing={current?.id === track.id && playing}
              onPlay={() => handlePlay(track)}
            />
          ))}
        </InfiniteSlider>
        </div>
      </div>
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
    <article className="group relative aspect-square w-[148px] shrink-0 overflow-hidden rounded-card border border-line/60 shadow-e1 opacity-[0.55] transition-[opacity,border-color,box-shadow,transform] duration-300 ease-out hover:z-10 hover:scale-[1.02] hover:border-ice/40 hover:opacity-100 hover:shadow-e2 focus-within:z-10 focus-within:border-ice/40 focus-within:opacity-100 focus-within:shadow-e2 sm:w-[168px]">
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
          <span className="absolute right-2 top-2 rounded-full bg-[#1DB954] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.08em] text-black shadow-e1">
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
        <span className="truncate text-[10px] text-white/65">
          {track.artist_alias || "Open track"}
        </span>
      </Link>
    </article>
  );
}
