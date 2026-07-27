"use client";

import { useDroppable } from "@dnd-kit/core";
import type { Stage, Track } from "@/lib/types";
import { TrackCard } from "@/components/tracks/track-card";
import { cn } from "@/lib/utils";

type KanbanColumnProps = {
  stage: Stage;
  tracks: Track[];
  isOver: boolean;
  onOpenTrack: (track: Track) => void;
};

export function KanbanColumn({
  stage,
  tracks,
  isOver,
  onOpenTrack,
}: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: stage.id,
    data: { stage },
  });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex w-[280px] shrink-0 flex-col rounded-card border border-line bg-bg-0/40",
        isOver && "border-ice/30 bg-bg-1/40"
      )}
    >
      <header className="px-3 pt-3 pb-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-sm font-semibold tracking-tight text-text-hi">
            {stage.name}
          </h2>
          <span className="font-mono text-[11px] text-text-lo">
            {tracks.length}
          </span>
        </div>
        {isOver ? <div className="flare-line mt-2" /> : null}
      </header>

      <div className="flex flex-1 flex-col gap-2 px-2 pb-3">
        {tracks.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-text-lo/80">
            No tracks in {stage.name}. Drag one in, or start something new.
          </p>
        ) : (
          tracks.map((track) => (
            <TrackCard key={track.id} track={track} onOpen={onOpenTrack} />
          ))
        )}
      </div>
    </section>
  );
}
