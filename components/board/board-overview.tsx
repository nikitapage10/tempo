"use client";

import { AlertTriangle, StickyNote } from "lucide-react";
import { useActiveArtistPalette } from "@/components/active-artist-provider";
import { deriveAttentionSignals } from "@/lib/attention/signals";
import { stageHueAt, stageProgressFromSort } from "@/lib/stage-hue";
import { momentumDotClass } from "@/lib/track-style";
import type { BoardNote, Stage, Track } from "@/lib/types";
import { cn } from "@/lib/utils";

const TRACK_PREVIEW_CAP = 7;

export function BoardOverview({ stages, tracksByStage, notesByStage, onFocusStage }: {
  stages: Stage[];
  tracksByStage: Map<string, Track[]>;
  notesByStage: Map<string, BoardNote[]>;
  onFocusStage: (index: number) => void;
}) {
  const hues = useActiveArtistPalette();
  return (
    <div className="grid min-w-0 gap-1.5 pb-3" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }} aria-label="All board stages overview">
      {stages.map((stage, index) => {
        const tracks = tracksByStage.get(stage.id) ?? [];
        const notes = notesByStage.get(stage.id) ?? [];
        const itemCount = tracks.length + notes.length;
        const attentionCount = tracks.filter((track) => deriveAttentionSignals({ track }).length > 0).length;
        const hue = stageHueAt(stageProgressFromSort(stage.sort, stages), hues);
        const hiddenCount = Math.max(0, tracks.length - TRACK_PREVIEW_CAP);
        return (
          <section key={stage.id} className="prism-edge relative min-w-0 overflow-hidden rounded-card border border-line bg-gradient-to-b from-[#141419] to-[#0e0e12] shadow-e1">
            <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24" style={{ background: `linear-gradient(180deg, ${hue}16, transparent)` }} />
            <button type="button" onClick={() => onFocusStage(index)} className="relative block w-full border-b border-line/70 px-2 py-2 text-left hover:bg-white/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ice" aria-label={`Open ${stage.name} in detailed view`}>
              <span className="block truncate font-display text-xs font-semibold text-text-hi sm:text-xs">{stage.name}</span>
              <span className="mt-1 flex items-center gap-1.5 font-mono text-[10px] tabular-nums text-text-lo">
                <span>{itemCount}</span>
                {attentionCount > 0 ? <span className="inline-flex items-center gap-0.5 text-warn"><AlertTriangle className="size-2.5" />{attentionCount}</span> : null}
                {notes.length > 0 ? <span className="inline-flex items-center gap-0.5"><StickyNote className="size-2.5" />{notes.length}</span> : null}
              </span>
            </button>
            <div className="relative space-y-px p-1.5">
              {tracks.slice(0, TRACK_PREVIEW_CAP).map((track) => {
                const attention = deriveAttentionSignals({ track }).length > 0;
                return (
                  <button key={track.id} type="button" onClick={() => onFocusStage(index)} className="flex w-full min-w-0 items-center gap-1.5 rounded-[5px] px-1 py-1 text-left hover:bg-white/[0.035] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ice" title={track.title}>
                    <span className={cn("size-1.5 shrink-0 rounded-full", momentumDotClass(track.momentum))} aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-text-mid sm:text-[11px]">{track.title}</span>
                    {attention ? <AlertTriangle className="size-2.5 shrink-0 text-warn" /> : null}
                  </button>
                );
              })}
              {tracks.length === 0 ? <p className="px-1 py-3 text-center text-[10px] text-text-lo/45">Empty</p> : null}
              {hiddenCount > 0 ? <p className="px-1 pt-1 font-mono text-[10px] text-text-lo/55">+{hiddenCount} more</p> : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
