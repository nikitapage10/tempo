"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TRACK_TYPES } from "@/lib/constants";
import type { Track, TrackType, TrackUpdate } from "@/lib/types";

type TrackDetailsProps = {
  track: Track;
  onPatch: (patch: TrackUpdate) => Promise<void>;
  /** Viewers/commenters see these fields but can't change them (RLS enforces this either way). */
  readOnly?: boolean;
};

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function TrackDetails({ track, onPatch, readOnly }: TrackDetailsProps) {
  const [artistAlias, setArtistAlias] = React.useState(
    track.artist_alias ?? ""
  );
  const [bpm, setBpm] = React.useState(
    track.bpm != null ? String(track.bpm) : ""
  );
  const [musicalKey, setMusicalKey] = React.useState(track.musical_key ?? "");
  const [genre, setGenre] = React.useState(track.genre ?? "");
  const [destination, setDestination] = React.useState(track.destination ?? "");
  const [tags, setTags] = React.useState((track.tags ?? []).join(", "));
  const [type, setType] = React.useState<TrackType>(track.type);

  React.useEffect(() => {
    setArtistAlias(track.artist_alias ?? "");
    setBpm(track.bpm != null ? String(track.bpm) : "");
    setMusicalKey(track.musical_key ?? "");
    setGenre(track.genre ?? "");
    setDestination(track.destination ?? "");
    setTags((track.tags ?? []).join(", "));
    setType(track.type);
  }, [track]);

  async function commit(patch: TrackUpdate) {
    await onPatch(patch);
  }

  return (
    <section className="rounded-card border border-line bg-bg-1 p-4">
      <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.08em] text-text-lo">
        Details
      </h2>
      <div className="space-y-3">
        <div>
          <Label htmlFor="detail-alias">Artist / alias</Label>
          <Input
            id="detail-alias"
            value={artistAlias}
            disabled={readOnly}
            onChange={(e) => setArtistAlias(e.target.value)}
            onBlur={() => {
              const next = artistAlias.trim() || null;
              if (next !== (track.artist_alias ?? null)) {
                void commit({ artist_alias: next });
              }
            }}
          />
        </div>

        <div>
          <Label htmlFor="detail-type">Type</Label>
          <select
            id="detail-type"
            value={type}
            disabled={readOnly}
            onChange={(e) => {
              const next = e.target.value as TrackType;
              setType(next);
              void commit({ type: next });
            }}
            className="flex h-9 w-full rounded-input border border-line bg-bg-2 px-3 text-sm text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice disabled:opacity-50"
          >
            {TRACK_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="detail-bpm">BPM</Label>
            <Input
              id="detail-bpm"
              className="font-mono"
              inputMode="decimal"
              value={bpm}
              disabled={readOnly}
              onChange={(e) => setBpm(e.target.value)}
              onBlur={() => {
                const next = bpm.trim() ? Number(bpm) : null;
                if (next !== track.bpm && (next == null || !Number.isNaN(next))) {
                  void commit({ bpm: next });
                }
              }}
              placeholder="124"
            />
          </div>
          <div>
            <Label htmlFor="detail-key">Key</Label>
            <Input
              id="detail-key"
              className="font-mono"
              value={musicalKey}
              disabled={readOnly}
              onChange={(e) => setMusicalKey(e.target.value)}
              onBlur={() => {
                const next = musicalKey.trim() || null;
                if (next !== (track.musical_key ?? null)) {
                  void commit({ musical_key: next });
                }
              }}
              placeholder="F♯m"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="detail-genre">Genre</Label>
          <Input
            id="detail-genre"
            value={genre}
            disabled={readOnly}
            onChange={(e) => setGenre(e.target.value)}
            onBlur={() => {
              const next = genre.trim() || null;
              if (next !== (track.genre ?? null)) {
                void commit({ genre: next });
              }
            }}
          />
        </div>

        <div>
          <Label htmlFor="detail-dest">Destination</Label>
          <Input
            id="detail-dest"
            value={destination}
            disabled={readOnly}
            onChange={(e) => setDestination(e.target.value)}
            onBlur={() => {
              const next = destination.trim() || null;
              if (next !== (track.destination ?? null)) {
                void commit({ destination: next });
              }
            }}
            placeholder="Label / self / pack"
          />
        </div>

        <div>
          <Label htmlFor="detail-tags">Tags</Label>
          <Input
            id="detail-tags"
            value={tags}
            disabled={readOnly}
            onChange={(e) => setTags(e.target.value)}
            onBlur={() => {
              const next = parseTags(tags);
              const prev = track.tags ?? [];
              const same =
                next.length === prev.length &&
                next.every((t, i) => t === prev[i]);
              if (!same) void commit({ tags: next });
            }}
            placeholder="club, vocal, summer — comma separated"
          />
        </div>
      </div>
    </section>
  );
}
