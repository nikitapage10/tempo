"use client";

import { Radio, Users } from "lucide-react";
import { ArtistMark } from "@/components/artists/artist-mark";
import { ConnectionGlobe, type GlobePerson } from "@/components/social/connection-globe";
import { PageHeader } from "@/components/ui/page-header";
import { DEMO_SOCIAL_ARTISTS, DEMO_SOCIAL_POSTS } from "@/lib/demo/president";

/**
 * A recognisable social surface for the shared PRESIDENT demo.
 *
 * These are examples, not fabricated TEMPO accounts. Keeping them out of the
 * follow graph prevents demo visitors from seeing whichever test/member
 * profiles happen to exist in the current database, and avoids impersonating
 * real artists with interactive profiles or authored posts.
 */
export function DemoSocialView() {
  const globePeople: GlobePerson[] = DEMO_SOCIAL_ARTISTS.map((artist, index) => ({
    id: `demo-social-${artist.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    name: artist.name,
    handle: null,
    emblemUrl: null,
    paletteId: index % 2 === 0 ? "noir" : "spectra",
    iceColor: null,
    amberColor: null,
    location: artist.location,
    countryCode: artist.countryCode,
    detail: artist.connection,
    personId: null,
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Social"
        subtitle="A demo-only look at the network around a working artist."
      />

      <div className="panel-quiet flex items-start gap-3 px-4 py-3 text-sm text-text-lo">
        <Radio className="mt-0.5 size-4 shrink-0 text-ice" />
        <p>
          These recognisable artists and conversations are fictional shared examples,
          not official TEMPO accounts or real posts. Your own Social feed only
          contains people who actually join the network.
        </p>
      </div>

      <section className="panel relative overflow-hidden px-4 pt-4 sm:px-6 sm:pt-5">
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="label-mono text-ice">Connections in motion</p>
            <h2 className="mt-1 font-display text-xl font-semibold text-text-hi">
              A heavy-music world around the project
            </h2>
          </div>
          <p className="max-w-sm text-xs leading-5 text-text-lo">
            Drag to spin, scroll to zoom, and hover a marker. The globe keeps
            moving gently while the demo is open.
          </p>
        </div>
        <ConnectionGlobe people={globePeople} max={globePeople.length} className="min-h-[360px]" />
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="label-mono flex items-center gap-1.5">
              <Users className="size-3" /> Connected artists
            </p>
            <span className="text-xs text-text-lo">
              {DEMO_SOCIAL_ARTISTS.length} examples
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {DEMO_SOCIAL_ARTISTS.map((artist, index) => (
              <article key={artist.name} className="panel-quiet lift p-4">
                <div className="flex items-center gap-3">
                  <ArtistMark
                    emblemUrl={null}
                    paletteId={index % 2 === 0 ? "noir" : "spectra"}
                    name={artist.name}
                    size={34}
                    className="size-[34px] shrink-0"
                  />
                  <div className="min-w-0">
                    <h2 className="truncate font-display text-base text-text-hi">
                      {artist.name}
                    </h2>
                    <p className="truncate text-xs text-text-lo">
                      {artist.connection}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line/60 pt-3">
                  {artist.genres.map((genre) => (
                    <span
                      key={genre}
                      className="rounded-chip border border-line px-2 py-1 text-xs text-text-lo"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="panel min-w-0 overflow-hidden lg:sticky lg:top-4 lg:self-start">
          <div className="flex items-center justify-between gap-2 px-4 pt-4">
            <p className="label-mono">Feed preview</p>
            <span className="text-[11px] uppercase tracking-[0.12em] text-amber">
              Demo only
            </span>
          </div>
          <div className="flare-line mx-4 mt-3" aria-hidden />
          <div className="max-h-[34rem] space-y-3 overflow-y-auto p-4">
            {DEMO_SOCIAL_POSTS.map((post, index) => (
              <article key={`${post.author}:${index}`} className="well rounded-card p-3.5">
                <div className="flex items-center gap-2.5">
                  <ArtistMark
                    emblemUrl={null}
                    paletteId={index % 2 === 0 ? "noir" : "spectra"}
                    name={post.author}
                    size={24}
                    className="size-6 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-hi">
                      {post.author}
                    </p>
                    <p className="text-[11px] uppercase tracking-[0.1em] text-text-lo">
                      Sample feed card
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-text-lo">
                  {post.body}
                </p>
                {post.reply ? (
                  <div className="mt-3 border-l-2 border-ice/25 pl-3">
                    <p className="text-xs font-medium text-ice">{post.reply.author}</p>
                    <p className="mt-1 text-xs leading-5 text-text-lo">{post.reply.body}</p>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
