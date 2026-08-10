"use client";

import { Radio, Users } from "lucide-react";
import { ArtistMark } from "@/components/artists/artist-mark";
import { PageHeader } from "@/components/ui/page-header";
import { DEMO_SOCIAL_ARTISTS } from "@/lib/demo/president";

/**
 * A recognisable social surface for the shared PRESIDENT demo.
 *
 * These are examples, not fabricated TEMPO accounts. Keeping them out of the
 * follow graph prevents demo visitors from seeing whichever test/member
 * profiles happen to exist in the current database, and avoids impersonating
 * real artists with interactive profiles or authored posts.
 */
export function DemoSocialView() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Social"
        subtitle="A demo-only look at the network around a working artist."
      />

      <div className="panel-quiet flex items-start gap-3 px-4 py-3 text-sm text-text-lo">
        <Radio className="mt-0.5 size-4 shrink-0 text-ice" />
        <p>
          These recognisable artists are shared examples, not official TEMPO
          accounts or real posts. Your own Social feed only contains people who
          actually join the network.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="label-mono flex items-center gap-1.5">
              <Users className="size-3" /> Connected artists
            </p>
            <span className="text-[11px] text-text-lo">
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
                      className="rounded-chip border border-line px-2 py-1 text-[11px] text-text-lo"
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
            <span className="text-[10px] uppercase tracking-[0.12em] text-amber">
              Demo only
            </span>
          </div>
          <div className="flare-line mx-4 mt-3" aria-hidden />
          <div className="max-h-[34rem] space-y-3 overflow-y-auto p-4">
            {DEMO_SOCIAL_ARTISTS.map((artist, index) => (
              <article key={artist.name} className="well rounded-card p-3.5">
                <div className="flex items-center gap-2.5">
                  <ArtistMark
                    emblemUrl={null}
                    paletteId={index % 2 === 0 ? "noir" : "spectra"}
                    name={artist.name}
                    size={24}
                    className="size-6 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-hi">
                      {artist.name}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.1em] text-text-lo">
                      Sample feed card
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-text-lo">
                  {artist.sampleUpdate}
                </p>
              </article>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
