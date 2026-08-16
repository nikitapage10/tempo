"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { FlareLine } from "@/components/flare-line";
import { ArtistProfileImage } from "@/components/artists/artist-mark";
import { ArtistProfileStoryView } from "@/components/artist/profile-story";
import type { PublicArtistProfile } from "@/lib/public-profile-server";

async function fetchPublicProfile(handle: string): Promise<PublicArtistProfile> {
  const res = await fetch(`/api/p/${handle}`, { cache: "no-store" });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "This profile isn’t available.");
  return body;
}

export function PublicProfileView({ handle }: { handle: string }) {
  const query = useQuery({
    queryKey: ["public-profile", handle],
    queryFn: () => fetchPublicProfile(handle),
    retry: false,
  });

  return (
    <main className="min-h-screen bg-bg-0 px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-5xl">
        <p className="font-display text-lg font-bold tracking-tight text-text-hi">TEMPO</p>

        {query.isLoading ? (
          <div className="mt-8 space-y-4">
            <div className="h-40 animate-pulse rounded-panel bg-bg-2" />
            <div className="h-24 animate-pulse rounded-panel bg-bg-2" />
          </div>
        ) : query.isError || !query.data ? (
          <div className="mt-8 rounded-panel border border-line bg-bg-1 p-8 text-center">
            <p className="text-sm text-text-lo">
              {query.error instanceof Error
                ? query.error.message
                : "This profile isn’t available."}
            </p>
          </div>
        ) : (
          <ProfileContent profile={query.data} />
        )}
      </div>
    </main>
  );
}

function ProfileContent({ profile }: { profile: PublicArtistProfile }) {
  const colorWash =
    profile.banner_color && profile.banner_color_end
      ? `linear-gradient(125deg, ${profile.banner_color} 0%, ${profile.banner_color_end} 42%, var(--bg-0) 100%)`
      : profile.banner_color
        ? `linear-gradient(180deg, ${profile.banner_color} 0%, var(--bg-0) 100%)`
        : undefined;

  return (
    <div className="mt-6 space-y-5">
      <div className="relative overflow-hidden rounded-panel border border-line shadow-e3">
        <div className="absolute inset-0">
          {profile.banner_url ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={profile.banner_url}
                alt=""
                className="absolute inset-0 size-full object-cover"
              />
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, rgb(10 10 12 / 0.55) 0%, rgb(10 10 12 / 0.8) 70%, var(--bg-0) 100%)",
                }}
              />
            </>
          ) : colorWash ? (
            <div aria-hidden className="absolute inset-0" style={{ background: colorWash }} />
          ) : null}
        </div>

        {profile.emblem_url ? (
          <ArtistProfileImage
            emblemUrl={profile.emblem_url}
            paletteId={profile.palette_id}
            iceColor={profile.ice_color}
            amberColor={profile.amber_color}
            name={profile.display_name}
            className="absolute inset-y-0 left-[27%] z-[1] hidden w-[25%] sm:flex"
          />
        ) : null}

        <div className="relative z-[2] px-6 py-8 sm:px-8 sm:py-10">
          <h1 className="min-w-0 font-display text-3xl font-semibold tracking-tight text-text-hi sm:text-[40px] sm:leading-[1.05]">
            {profile.display_name}
          </h1>
          <p className="mt-1 text-sm text-text-lo">
            @{profile.handle}
            {profile.pronouns ? ` · ${profile.pronouns}` : ""}
            {profile.location ? ` · ${profile.location}` : ""}
          </p>
          {profile.tagline ? (
            <p className="mt-1.5 max-w-lg text-sm text-text-lo">{profile.tagline}</p>
          ) : null}
        </div>
      </div>

      <ArtistProfileStoryView
        profile={profile}
        releasedTracks={profile.released_tracks}
        variant={profile.profile_kind === "pro" ? "pro" : "artist"}
      />

      <FlareLine className="max-w-[240px] opacity-50" />
      <p className="text-center text-xs text-text-lo">Made with TEMPO</p>
    </div>
  );
}
