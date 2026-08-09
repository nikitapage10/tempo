"use client";

import * as React from "react";
import { ArrowUpRight, Play, Sparkles } from "lucide-react";
import { SpotifyEmbedPlayer, resolveSpotifyTrackId } from "@/components/spotify/spotify-embed-player";
import type {
  ProfileLink,
  ProfileReleasedTrack,
  ProfileSoundMarker,
  ProfileStorySection,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export type ArtistProfileStory = {
  bio: string | null;
  backstory: string | null;
  genres: string[];
  roles: string[];
  links: ProfileLink[];
  story_sections?: ProfileStorySection[];
  sound_markers?: ProfileSoundMarker[];
  current_focus_title?: string | null;
  current_focus_body?: string | null;
};

export function ArtistProfileStoryView({
  profile,
  releasedTracks = [],
  emptyAction,
}: {
  profile: ArtistProfileStory | null;
  releasedTracks?: ProfileReleasedTrack[];
  emptyAction?: React.ReactNode;
}) {
  const markers = profile?.sound_markers ?? [];
  const released = releasedTracks
    .filter((track) => resolveSpotifyTrackId(track.spotify_track_id, track.spotify_url))
    .slice(0, 4);
  const links = (profile?.links ?? []).filter((link) => isSafeWebUrl(link.url));
  const storySections = (profile?.story_sections ?? []).filter(
    (section) => section.title.trim() || section.body.trim()
  );
  const legacyStory = profile?.backstory?.trim()
    ? [{ title: "The longer arc", body: profile.backstory.trim() }]
    : [];
  const story = storySections.length ? storySections : legacyStory;
  const hasFocus = Boolean(profile?.current_focus_title || profile?.current_focus_body);
  const hasIdentity = Boolean(profile?.bio || profile?.genres.length || profile?.roles.length);
  const hasContent = Boolean(
    profile?.bio ||
      story.length ||
      markers.length ||
      released.length ||
      hasFocus ||
      hasIdentity ||
      links.length
  );

  if (!hasContent) {
    return (
      <section className="panel-quiet relative overflow-hidden p-6 sm:p-8">
        <div aria-hidden className="absolute -right-20 -top-24 size-56 rounded-full border border-ice/10 bg-ice/[0.025]" />
        <div className="relative flex max-w-2xl flex-col gap-3">
          <div className="flex items-center gap-2 text-ice">
            <Sparkles className="size-4" strokeWidth={1.75} />
            <p className="label-mono text-ice">Waiting for a first signal</p>
          </div>
          <p className="text-sm leading-relaxed text-text-lo">
            Add an introduction, the sounds that keep returning, what is taking shape
            now, and a few pieces of music you want people to hear first.
          </p>
          {emptyAction}
        </div>
      </section>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      {hasIdentity ? (
        <section className="panel-quiet relative overflow-hidden p-6 sm:p-7 lg:col-span-8">
          <ProfileSectionHeading kicker="About" title="Who they are and what they make" />
          {profile?.bio ? (
            <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-text-hi/90">
              {profile.bio}
            </p>
          ) : null}
          {profile?.genres.length || profile?.roles.length ? (
            <div className="mt-5 flex flex-wrap gap-1.5 border-t border-line/60 pt-4">
              {profile.genres.map((genre) => (
                <span key={genre} className="rounded-chip border border-line px-2.5 py-1 text-xs text-text-lo">
                  {genre}
                </span>
              ))}
              {profile.roles.map((role) => (
                <span key={role} className="rounded-chip border border-ice/30 bg-ice/10 px-2.5 py-1 text-xs text-ice">
                  {role}
                </span>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {released.length || hasFocus ? (
        <div
          className={cn(
            "space-y-4",
            hasIdentity ? "lg:col-span-4" : "lg:col-span-12"
          )}
        >
          {released.length ? <ReleasedTracksPanel tracks={released} /> : null}
          {hasFocus ? (
            <section className="panel-quiet relative overflow-hidden p-6 sm:p-7">
              <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--amber),transparent)]" />
              <p className="label-mono text-amber">Right now</p>
              {profile?.current_focus_title ? (
                <h2 className="mt-4 font-display text-xl text-text-hi">
                  {profile.current_focus_title}
                </h2>
              ) : null}
              {profile?.current_focus_body ? (
                <p className="mt-3 text-sm leading-6 text-text-lo">{profile.current_focus_body}</p>
              ) : null}
            </section>
          ) : null}
        </div>
      ) : null}

      {markers.length ? (
        <section
          className={cn(
            "panel-quiet relative overflow-hidden p-6 sm:p-7",
            links.length ? "lg:col-span-8" : "lg:col-span-12"
          )}
        >
          <ProfileSectionHeading kicker="The sound" title="What the music carries" />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {markers.map((marker, index) => (
              <div
                key={`${marker.label}-${index}`}
                className="relative overflow-hidden rounded-card border border-line/70 bg-white/[0.022] p-4"
              >
                <span className="absolute right-3 top-2 text-[10px] text-ice/50">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="pr-8 font-display text-base text-text-hi">{marker.label}</h3>
                {marker.description ? (
                  <p className="mt-2 text-sm leading-6 text-text-lo">{marker.description}</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {links.length ? (
        <section className={cn("panel-quiet p-6 sm:p-7", markers.length ? "lg:col-span-4" : "lg:col-span-12")}>
          <ProfileSectionHeading kicker="Listen and connect" title="Find the signal elsewhere" />
          <ul className="mt-5 space-y-2">
            {links.map((link, index) => (
              <li key={`${link.label}-${index}`}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center justify-between gap-3 rounded-input border border-line/60 px-3 py-2.5 text-sm text-text-hi transition-colors hover:border-ice/40"
                >
                  <span className="truncate">{link.label}</span>
                  <ArrowUpRight className="size-3.5 shrink-0 text-text-lo transition-colors group-hover:text-ice" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {story.length ? (
        <section className="panel-quiet overflow-hidden p-6 sm:p-7 lg:col-span-12">
          <ProfileSectionHeading kicker="The story" title="How the work arrived here" />
          <div className="mt-6 grid gap-3 lg:grid-cols-2">
            {story.map((section, index) => (
              <article
                key={`${section.title}-${index}`}
                className="relative overflow-hidden rounded-card border border-line/70 bg-white/[0.022] p-5"
              >
                <span className="absolute right-4 top-3 font-mono text-[10px] text-ice/45">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {section.title ? (
                  <h3 className="pr-8 font-display text-lg text-text-hi">{section.title}</h3>
                ) : null}
                <p className={cn("whitespace-pre-wrap text-sm leading-7 text-text-hi/85", section.title && "mt-3")}>
                  {section.body}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ReleasedTracksPanel({ tracks }: { tracks: ProfileReleasedTrack[] }) {
  const [selectedId, setSelectedId] = React.useState(tracks[0]?.id ?? null);
  const selected =
    tracks.find((track) => track.id === selectedId) ?? tracks[0] ?? null;

  React.useEffect(() => {
    if (!tracks.some((track) => track.id === selectedId)) {
      setSelectedId(tracks[0]?.id ?? null);
    }
  }, [selectedId, tracks]);

  if (!selected) return null;

  return (
    <section className="panel-quiet relative overflow-hidden p-5 sm:p-6">
      <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--ice),transparent)]" />
      <p className="label-mono text-ice">Released music</p>
      <h2 className="mt-2 font-display text-xl text-text-hi">Listen here</h2>

      <SpotifyEmbedPlayer
        className="mt-4"
        trackTitle={selected.title}
        spotifyTrackId={selected.spotify_track_id}
        spotifyUrl={selected.spotify_url}
      />

      {tracks.length > 1 ? (
        <div className="mt-3 space-y-1.5 border-t border-line/60 pt-3">
          {tracks.map((track) => {
            const active = track.id === selected.id;
            return (
              <button
                key={track.id}
                type="button"
                aria-pressed={active}
                onClick={() => setSelectedId(track.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-input border px-3 py-2 text-left transition-colors",
                  active
                    ? "border-ice/35 bg-ice/10 text-text-hi"
                    : "border-transparent text-text-lo hover:border-line hover:text-text-hi"
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{track.title}</span>
                  {track.spotify_album_name ? (
                    <span className="mt-0.5 block truncate text-[11px] text-text-lo">
                      {track.spotify_album_name}
                    </span>
                  ) : null}
                </span>
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-black/35 text-ice">
                  <Play className="size-3.5 translate-x-px" fill="currentColor" />
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function ProfileSectionHeading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div>
      <p className="label-mono">{kicker}</p>
      <h2 className="mt-2 font-display text-xl text-text-hi">{title}</h2>
    </div>
  );
}

function isSafeWebUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
