"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FlareLine } from "@/components/flare-line";
import { LfWindow } from "@/components/lf-windows";
import { EmptyShaderPanel } from "@/components/shader-empty";
import { SignedImage } from "@/components/ui/signed-image";
import { fetchArtistProfileByHandle } from "@/lib/api/artist-profile";

/**
 * Read-only, in-app view of another TEMPO artist's profile, reached from the
 * network (Social) or a shared handle. RLS on `artist_profiles` already
 * limits this to profiles that are `members`/`public` (or your own) — this
 * page adds no visibility logic of its own.
 */
export default function ArtistProfileByHandlePage() {
  const params = useParams<{ handle: string }>();
  const handle = params.handle;

  const query = useQuery({
    queryKey: ["artist-profile-by-handle", handle],
    queryFn: () => fetchArtistProfileByHandle(handle),
    enabled: !!handle,
  });

  if (query.isLoading) {
    return (
      <div className="space-y-5">
        <div className="panel h-48 animate-pulse" />
        <div className="panel-quiet h-24 animate-pulse" />
      </div>
    );
  }

  if (!query.data) {
    return (
      <EmptyShaderPanel
        title="Profile not found"
        copy="This artist either doesn't exist, hasn't published a profile, or isn't visible to you."
      />
    );
  }

  const profile = query.data;

  return (
    <div className="space-y-5">
      <LfWindow className="relative overflow-hidden rounded-panel border border-line shadow-e3">
        <div className="absolute inset-0">
          <div className="scrim-reveal absolute inset-0" aria-hidden />
          {profile.banner_url || profile.banner_color ? (
            <div className="absolute inset-0">
              {profile.banner_url ? (
                <SignedImage
                  path={profile.banner_url}
                  alt=""
                  className="absolute inset-0 size-full object-cover"
                />
              ) : (
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{
                    background: profile.banner_color_end
                      ? `linear-gradient(125deg, ${profile.banner_color} 0%, ${profile.banner_color_end} 42%, var(--bg-0) 100%)`
                      : `linear-gradient(180deg, ${profile.banner_color} 0%, var(--bg-0) 100%)`,
                  }}
                />
              )}
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, rgb(10 10 12 / 0.55) 0%, rgb(10 10 12 / 0.8) 70%, var(--bg-0) 100%)",
                }}
              />
            </div>
          ) : null}
        </div>

        <div className="relative z-[1] flex items-start justify-between gap-3 px-6 py-8 sm:px-8 sm:py-10">
          <div className="flex items-center gap-3">
            {profile.emblem_url ? (
              <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-card border border-line bg-bg-2 shadow-e1">
                <SignedImage
                  path={profile.emblem_url}
                  alt={profile.display_name}
                  className="size-full object-cover"
                />
              </span>
            ) : null}
            <div className="min-w-0">
              <p className="label-mono mb-1.5">Artist profile</p>
              <h1 className="font-display text-3xl font-semibold tracking-tight text-text-hi sm:text-[40px] sm:leading-[1.05]">
                {profile.display_name}
              </h1>
              {profile.handle ? (
                <p className="mt-1 text-sm text-text-lo">@{profile.handle}</p>
              ) : null}
              {profile.tagline ? (
                <p className="mt-1.5 max-w-lg text-sm text-text-lo">{profile.tagline}</p>
              ) : null}
            </div>
          </div>

          <Button type="button" size="sm" variant="secondary" disabled title="Follows land in a later update">
            <UserPlus className="size-3.5" />
            Follow
          </Button>
        </div>

        <FlareLine className="relative z-[1] mx-6 mb-6 max-w-[420px] opacity-60 sm:mx-8" />
      </LfWindow>

      <div className="grid gap-4 lg:grid-cols-2">
        {profile.bio ? (
          <section className="panel-quiet p-6 lg:col-span-2">
            <p className="label-mono mb-2">Bio</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-hi">
              {profile.bio}
            </p>
          </section>
        ) : null}

        {profile.backstory ? (
          <section className="panel-quiet p-6 lg:col-span-2">
            <p className="label-mono mb-2">Backstory</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-hi">
              {profile.backstory}
            </p>
          </section>
        ) : null}

        {profile.genres.length || profile.roles.length ? (
          <section className="panel-quiet p-6">
            <p className="label-mono mb-2">Genres &amp; roles</p>
            <div className="flex flex-wrap gap-1.5">
              {profile.genres.map((g) => (
                <span key={g} className="rounded-chip border border-line px-2.5 py-1 text-xs text-text-lo">
                  {g}
                </span>
              ))}
              {profile.roles.map((r) => (
                <span
                  key={r}
                  className="rounded-chip border border-ice/30 bg-ice/10 px-2.5 py-1 text-xs text-ice"
                >
                  {r}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {profile.links.length ? (
          <section className="panel-quiet p-6">
            <p className="label-mono mb-2">Links</p>
            <ul className="space-y-1.5">
              {profile.links.map((link, i) => (
                <li key={i}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="well lift flex items-center gap-2 rounded-input px-3 py-2 text-sm text-text-hi"
                  >
                    <ExternalLink className="size-3.5 shrink-0 text-ice" />
                    <span className="truncate">{link.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
