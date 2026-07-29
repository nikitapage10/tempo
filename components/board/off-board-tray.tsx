"use client";

import { useDroppable } from "@dnd-kit/core";
import type { Track } from "@/lib/types";
import { TrackCard } from "@/components/tracks/track-card";
import { cn } from "@/lib/utils";

export const OFF_BOARD_DROPPABLE = "tempo:off-board";

type OffBoardTrayProps = {
  tracks: Track[];
  isOver: boolean;
  dragging: boolean;
  compact?: boolean;
  onOpenTrack: (track: Track) => void;
};

/**
 * Holding area for tracks with no stage — still in the catalog, just not on
 * the board. Doubles as the drop target while dragging.
 */
export function OffBoardTray({
  tracks,
  isOver,
  dragging,
  compact,
  onOpenTrack,
}: OffBoardTrayProps) {
  const { setNodeRef } = useDroppable({
    id: OFF_BOARD_DROPPABLE,
    data: { offBoard: true },
  });

  if (tracks.length === 0 && !dragging) return null;

  return (
    <section
      ref={setNodeRef}
      aria-label={`Off board, ${tracks.length} ${
        tracks.length === 1 ? "track" : "tracks"
      }`}
      className={cn(
        "mt-2 rounded-panel border border-dashed px-3 py-2.5 transition-colors duration-hover",
        isOver
          ? "border-ice/50 bg-ice/[0.06]"
          : "border-line/70 bg-bg-0/40"
      )}
    >
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-display text-sm font-semibold tracking-tight text-text-hi">
            Off board
            {tracks.length > 0 ? (
              <span className="ml-2 rounded-chip bg-bg-3 px-1.5 py-0.5 font-mono text-[10px] font-normal tabular-nums text-text-lo">
                {tracks.length}
              </span>
            ) : null}
          </h2>
          <p className="mt-0.5 text-[11px] text-text-lo/70">
            Still in Tracks — drag onto a stage to put back on the board.
          </p>
        </div>
        {dragging ? (
          <p className="text-[11px] text-ice">
            {isOver ? "Drop to take off the board" : "Drop here to remove"}
          </p>
        ) : null}
      </div>

      {tracks.length === 0 ? (
        <div className="flex min-h-[48px] items-center justify-center rounded-card border border-dashed border-line/50 px-3 py-2 text-[11px] text-text-lo/60">
          Drop a track here to take it off the board
        </div>
      ) : (
        <ul
          className={cn(
            "grid gap-2",
            compact
              ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              : "sm:grid-cols-2 lg:grid-cols-3"
          )}
        >
          {tracks.map((track) => (
            <li key={track.id}>
              <TrackCard
                track={track}
                onOpen={onOpenTrack}
                compact={compact}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
