"use client";

import * as React from "react";
import { Check, ExternalLink, Music2, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SignedImage } from "@/components/ui/signed-image";
import {
  matchImportSpotifyCatalog,
  searchImportSpotifyArtists,
  type SpotifyArtistCandidate,
  type SpotifyImportPreview,
  type SpotifyImportSelection,
} from "@/lib/api/onboarding-imports";
import { cn } from "@/lib/utils";

type Props = {
  importId: string;
  artistName: string;
  linkedSpotifyArtistId: string | null;
  tracks: { ref: string; title: string }[];
  preview: SpotifyImportPreview | null;
  onPreviewChange: (preview: SpotifyImportPreview | null) => void;
  onBack: () => void;
  onSkip: () => void;
  onContinue: (selection: SpotifyImportSelection) => void;
};

function duration(ms: number | null): string | null {
  if (!ms) return null;
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function SpotifyCatalogStep({
  importId,
  artistName,
  linkedSpotifyArtistId,
  tracks,
  preview,
  onPreviewChange,
  onBack,
  onSkip,
  onContinue,
}: Props) {
  const [query, setQuery] = React.useState(artistName);
  const [results, setResults] = React.useState<SpotifyArtistCandidate[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [matching, setMatching] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [copyArtwork, setCopyArtwork] = React.useState(true);
  const attemptedLinked = React.useRef(false);

  const chooseArtist = React.useCallback(
    async (candidate: SpotifyArtistCandidate | { id: string }) => {
      setMatching(true);
      setError(null);
      try {
        const next = await matchImportSpotifyCatalog(importId, candidate.id, tracks);
        onPreviewChange(next);
        setResults([]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't read that catalog.");
      } finally {
        setMatching(false);
      }
    },
    [importId, onPreviewChange, tracks]
  );

  React.useEffect(() => {
    if (
      attemptedLinked.current ||
      preview ||
      !linkedSpotifyArtistId ||
      tracks.length === 0
    ) {
      return;
    }
    attemptedLinked.current = true;
    void chooseArtist({ id: linkedSpotifyArtistId });
  }, [chooseArtist, linkedSpotifyArtistId, preview, tracks.length]);

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      setResults(await searchImportSpotifyArtists(importId, query.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't search Spotify.");
    } finally {
      setSearching(false);
    }
  }

  function selectCandidate(trackRef: string, spotifyTrackId: string | null) {
    if (!preview) return;
    onPreviewChange({
      ...preview,
      matches: preview.matches.map((match) =>
        match.trackRef === trackRef
          ? { ...match, selectedTrackId: spotifyTrackId }
          : match
      ),
    });
  }

  const selectedCount =
    preview?.matches.filter((match) => match.selectedTrackId).length ?? 0;
  const reviewCount =
    preview?.matches.filter((match) => {
      const candidate = match.candidates.find((c) => c.id === match.selectedTrackId);
      return candidate?.confidence === "medium";
    }).length ?? 0;

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden">
        <div className="border-b border-line p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1DB954]/15 text-[#1DB954]">
              <Music2 className="size-4" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-text-hi">
                Match your released catalog
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-text-lo">
                Confirm your Spotify artist once. TEMPO will compare every selected
                track, bring in release metadata, and copy the cover files into your
                private TEMPO storage.
              </p>
            </div>
          </div>
        </div>

        {!preview ? (
          <div className="p-5">
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Artist name"
                aria-label="Spotify artist name"
              />
              <Button type="submit" variant="secondary" disabled={searching || matching}>
                <Search className="size-4" />
                {searching ? "Searching…" : "Search"}
              </Button>
            </form>

            {matching ? (
              <div className="mt-5 rounded-card border border-ice/25 bg-ice/5 p-4 text-sm text-text-hi">
                Reading releases and matching {tracks.length} track
                {tracks.length === 1 ? "" : "s"}…
              </div>
            ) : null}

            {results.length > 0 ? (
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {results.map((artist) => (
                  <li key={artist.id}>
                    <button
                      type="button"
                      onClick={() => void chooseArtist(artist)}
                      className="flex w-full items-center gap-3 rounded-card border border-line bg-bg-2/50 p-3 text-left transition-colors hover:border-ice/35 hover:bg-ice/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
                    >
                      <span className="relative size-11 shrink-0 overflow-hidden rounded-full bg-bg-3">
                        <SignedImage
                          path={artist.imageUrl}
                          alt=""
                          className="size-full"
                          fallback={<span className="flex size-full items-center justify-center"><Music2 className="size-4 text-text-lo" /></span>}
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-text-hi">
                          {artist.name}
                        </span>
                        <span className="font-data text-[11px] text-[#1DB954]">
                          Spotify artist
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {error ? <p className="mt-3 text-sm text-warn">{error}</p> : null}
          </div>
        ) : (
          <div className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="relative size-10 overflow-hidden rounded-full bg-bg-3">
                  <SignedImage path={preview.artist.imageUrl} alt="" className="size-full" />
                </span>
                <div>
                  <p className="text-sm font-medium text-text-hi">
                    Connected as {preview.artist.name}
                  </p>
                  <p className="font-data text-[11px] text-text-lo">
                    {preview.catalogTrackCount} released Spotify track
                    {preview.catalogTrackCount === 1 ? "" : "s"} found
                  </p>
                </div>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => onPreviewChange(null)}>
                Change artist
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-pill bg-ok/10 px-2.5 py-1 text-ok">
                {selectedCount} matched
              </span>
              {reviewCount ? (
                <span className="rounded-pill bg-amber/10 px-2.5 py-1 text-amber">
                  {reviewCount} worth checking
                </span>
              ) : null}
              <span className="rounded-pill bg-bg-3 px-2.5 py-1 text-text-lo">
                {tracks.length - selectedCount} unmatched
              </span>
            </div>
          </div>
        )}
      </section>

      {preview ? (
        <section>
          <ul className="space-y-2">
            {preview.matches.map((match) => {
              const selected = match.candidates.find(
                (candidate) => candidate.id === match.selectedTrackId
              );
              return (
                <li
                  key={match.trackRef}
                  className={cn(
                    "rounded-card border p-3",
                    selected ? "border-ice/25 bg-ice/5" : "border-line bg-bg-2/40"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="relative size-14 shrink-0 overflow-hidden rounded-input bg-bg-3">
                      <SignedImage
                        path={selected?.album.artworkUrl}
                        alt=""
                        className="size-full"
                        fallback={<span className="flex size-full items-center justify-center"><Music2 className="size-4 text-text-lo" /></span>}
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-hi">
                        {match.tempoTitle}
                      </p>
                      {selected ? (
                        <p className="mt-0.5 truncate text-xs text-text-lo">
                          {selected.title} · {selected.album.name}
                          {selected.album.releaseDate ? ` · ${selected.album.releaseDate}` : ""}
                          {duration(selected.durationMs) ? ` · ${duration(selected.durationMs)}` : ""}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-xs text-text-lo">No confident match</p>
                      )}
                      {selected ? (
                        <div className="mt-1 flex flex-wrap items-center gap-2 font-data text-[10px]">
                          <span className={selected.confidence === "high" ? "text-ok" : "text-amber"}>
                            {selected.reason}
                          </span>
                          {selected.isrc ? <span className="text-text-lo">ISRC {selected.isrc}</span> : null}
                          {selected.url ? (
                            <a
                              href={selected.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[#1DB954] hover:underline"
                            >
                              Open Spotify <ExternalLink className="size-2.5" />
                            </a>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <select
                      value={match.selectedTrackId ?? ""}
                      onChange={(event) =>
                        selectCandidate(match.trackRef, event.target.value || null)
                      }
                      aria-label={`Spotify match for ${match.tempoTitle}`}
                      className="h-8 max-w-56 rounded-input border border-line bg-bg-2 px-2 text-xs text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
                    >
                      <option value="">No match</option>
                      {match.candidates.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.title} — {candidate.album.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </li>
              );
            })}
          </ul>

          <label className="panel-quiet mt-4 flex cursor-pointer items-start gap-3 p-4">
            <input
              type="checkbox"
              checked={copyArtwork}
              onChange={(event) => setCopyArtwork(event.target.checked)}
              className="mt-1 size-3.5 accent-[var(--ice)]"
            />
            <span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-text-hi">
                <ShieldCheck className="size-4 text-ice" />
                Copy matched cover art into TEMPO
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-text-lo">
                The image files will live in your private TEMPO storage. Only copy
                artwork you own or have permission to store.
              </span>
            </span>
          </label>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="ghost" onClick={onBack}>Back</Button>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={onSkip}>Skip Spotify</Button>
          {preview ? (
            <Button
              type="button"
              size="lg"
              disabled={selectedCount === 0}
              onClick={() =>
                onContinue({
                  artistId: preview.artist.id,
                  artistName: preview.artist.name,
                  copyArtwork,
                  matches: preview.matches.flatMap((match) =>
                    match.selectedTrackId
                      ? [{ trackRef: match.trackRef, spotifyTrackId: match.selectedTrackId }]
                      : []
                  ),
                })
              }
            >
              <Check className="size-4" />
              Use {selectedCount} match{selectedCount === 1 ? "" : "es"}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
