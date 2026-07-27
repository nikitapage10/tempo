"use client";

import { useDroppable } from "@dnd-kit/core";
import type { Stage, Track } from "@/lib/types";
import { TrackCard } from "@/components/tracks/track-card";
import { LfWindow } from "@/components/lf-windows";
import {
  stageHueAt,
  stageProgressFromSort,
} from "@/lib/stage-hue";
import { cn } from "@/lib/utils";

type KanbanColumnProps = {
  stage: Stage;
  tracks: Track[];
  stages: Stage[];
  isOver: boolean;
  onOpenTrack: (track: Track) => void;
  compact?: boolean;
};

export function KanbanColumn({
  stage,
  tracks,
  stages,
  isOver,
  onOpenTrack,
  compact,
}: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: stage.id,
    data: { stage },
  });

  const progress = stageProgressFromSort(stage.sort, stages);
  const hue = stageHueAt(progress);

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex w-[280px] shrink-0 flex-col overflow-hidden rounded-card border border-line",
        isOver && "border-ice/30"
      )}
    >
      <LfWindow className="relative h-[2px] w-full shrink-0">
        <div
          className="absolute inset-0 opacity-[0.35] mix-blend-overlay"
          style={{ backgroundColor: hue }}
          aria-hidden
        />
      </LfWindow>

      <header className="bg-bg-0/90 px-3 pt-3 pb-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-sm font-semibold tracking-tight text-text-hi">
            {stage.name}
          </h2>
          <span className="font-mono text-[11px] text-text-lo">
            {tracks.length}
          </span>
        </div>
      </header>

      <div
        className={cn(
          "flex flex-1 flex-col gap-2 bg-bg-0/90 px-2 pb-3",
          isOver && "bg-bg-1/50"
        )}
      >
        {tracks.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-text-lo/80">
            Drag a track into {stage.name}.
          </p>
        ) : (
          tracks.map((track) => (
            <TrackCard
              key={track.id}
              track={track}
              onOpen={onOpenTrack}
              compact={compact}
            />
          ))
        )}
      </div>
    </section>
  );
}
