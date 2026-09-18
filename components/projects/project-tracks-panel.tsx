"use client";

import * as React from "react";
import Link from "next/link";
import { SectionHeader, QuietEmpty } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import { SpectraCoverArt } from "@/components/spectra/spectra-cover-art";
import { formatShortDate } from "@/lib/format";
import {
  sortTrackHealthRows,
  type ChecklistRollup,
} from "@/lib/projects/health";
import type { Stage, Track } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Compact attached-tracks list for the project sidebar (under Timeline). */
export function ProjectTracksPanel({
  tracks,
  stages,
  rollupByTrack,
  today,
  availableTracks,
  attachTrackId,
  onAttachTrackIdChange,
  onAttach,
  onDetach,
  attachPending,
}: {
  tracks: Track[];
  stages: Stage[];
  rollupByTrack: Map<string, ChecklistRollup>;
  today: string;
  availableTracks: Track[];
  attachTrackId: string;
  onAttachTrackIdChange: (id: string) => void;
  onAttach: () => void;
  onDetach: (trackId: string) => void;
  attachPending?: boolean;
}) {
  const trackRows = React.useMemo(
    () => sortTrackHealthRows(tracks, rollupByTrack, today),
    [tracks, rollupByTrack, today]
  );
  const stageName = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const stage of stages) map.set(stage.id, stage.name);
    return map;
  }, [stages]);

  return (
    <section className="panel-quiet rise-in p-5">
      <SectionHeader
        label="Tracks on this project"
        count={tracks.length}
        aside={
          <Link href="/tracks" className="text-xs text-ice hover:underline">
            New track
          </Link>
        }
      />
      <div className="mb-3 flex flex-col gap-2">
        <select
          className="h-8 w-full rounded-input border border-line bg-bg-2 px-2 text-xs"
          value={attachTrackId}
          onChange={(e) => onAttachTrackIdChange(e.target.value)}
          aria-label="Attach a track"
        >
          <option value="">Attach a track…</option>
          {availableTracks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
        <Button
          type="button"
          size="sm"
          className="w-full"
          disabled={!attachTrackId || attachPending}
          onClick={onAttach}
        >
          Attach
        </Button>
      </div>
      {trackRows.length === 0 ? (
        <QuietEmpty>No tracks attached yet.</QuietEmpty>
      ) : (
        // A record's worth of tracks would otherwise make this sidebar taller
        // than the rest of the page and push the release workspace below it
        // far out of view.
        <ul className="max-h-[26rem] space-y-1.5 overflow-y-auto pr-1">
          {trackRows.map(({ track, checklistPct, overdue }) => (
            <li key={track.id} className="well flex items-start gap-2.5 px-2 py-2">
              <div className="relative mt-0.5 size-7 shrink-0 overflow-hidden rounded-input border border-line">
                <SpectraCoverArt
                  trackId={track.id}
                  title={track.title}
                  artworkUrl={track.artwork_url}
                  animate={false}
                />
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/track/${track.id}`}
                  className="block truncate text-sm text-text-hi hover:text-ice"
                >
                  {track.title}
                </Link>
                <p className="mt-0.5 truncate font-data text-[10px] leading-snug text-text-lo">
                  {track.stage_id ? stageName.get(track.stage_id) ?? "Unstaged" : "Unstaged"}
                  {checklistPct != null ? ` · ${checklistPct}%` : null}
                  {track.next_action ? (
                    <span className={cn(overdue && "text-warn")}>
                      {" · "}
                      {track.next_action}
                      {track.next_action_due ? ` ${formatShortDate(track.next_action_due)}` : null}
                    </span>
                  ) : track.next_action_due ? (
                    <span className={cn(overdue && "text-warn")}>
                      {" · "}
                      {formatShortDate(track.next_action_due)}
                    </span>
                  ) : null}
                </p>
                <button
                  type="button"
                  className="mt-1 text-[11px] text-text-lo hover:text-warn"
                  onClick={() => onDetach(track.id)}
                >
                  Detach
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
