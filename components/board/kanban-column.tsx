"use client";

import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import { useActiveArtistPalette } from "@/components/active-artist-provider";
import type { BoardNote, Stage, Track } from "@/lib/types";
import { BoardNoteCard } from "@/components/board/board-note-card";
import {
  StageAddMenu,
  type StageAddAction,
} from "@/components/board/stage-add-menu";
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
  notes: BoardNote[];
  stages: Stage[];
  isOver: boolean;
  onOpenTrack: (track: Track) => void;
  onRemoveFromBoard?: (track: Track) => void;
  onStageAdd?: (action: StageAddAction) => void;
  onSaveNote?: (
    note: BoardNote,
    patch: { title: string; body: string | null }
  ) => void;
  onDeleteNote?: (note: BoardNote) => void;
  compact?: boolean;
  /** Sparse board — render cards with more presence. */
  roomy?: boolean;
  /** A card is currently being dragged — expand every stage so all are droppable. */
  dragging?: boolean;
  /** False when nothing is on the board at all, so we don't collapse every column to a rail. */
  allowCollapse?: boolean;
  /** Fill one slot in the three-stage focused board window. */
  fillAvailable?: boolean;
};

export function KanbanColumn({
  stage,
  tracks,
  notes,
  stages,
  isOver,
  onOpenTrack,
  onRemoveFromBoard,
  onStageAdd,
  onSaveNote,
  onDeleteNote,
  compact,
  roomy,
  dragging,
  allowCollapse = true,
  fillAvailable,
}: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: stage.id,
    data: { stage },
  });

  // A single stage can hold hundreds of tracks after a big catalog import —
  // render only the first page by default so the board stays responsive,
  // with an explicit toggle to reveal the rest.
  const TRACK_CAP = 30;
  const [showAll, setShowAll] = React.useState(false);
  const visibleTracks =
    showAll || tracks.length <= TRACK_CAP ? tracks : tracks.slice(0, TRACK_CAP);
  const hiddenCount = tracks.length - visibleTracks.length;

  const hues = useActiveArtistPalette();
  const progress = stageProgressFromSort(stage.sort, stages);
  const hue = stageHueAt(progress, hues);

  const itemCount = tracks.length + notes.length;

  // Empty stages give their width back to stages that actually hold work —
  // this is what keeps the whole pipeline on screen without horizontal scroll.
  const collapsed =
    allowCollapse && itemCount === 0 && !dragging && !isOver;

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "relative flex flex-col overflow-hidden rounded-panel border border-line",
        "bg-gradient-to-b from-[rgb(20_20_25/0.70)] to-[rgb(14_14_18/0.55)] shadow-e2 backdrop-blur-xl",
        "transition-[flex-grow,flex-basis,border-color,box-shadow] duration-300 ease-out motion-reduce:transition-none",
        // Stacked full-width below lg; sized columns from lg up.
        "w-full lg:min-h-[220px] lg:w-auto",
        fillAvailable
          ? "lg:min-w-0 lg:w-auto lg:basis-0 lg:grow"
          : collapsed
            ? "lg:w-11 lg:shrink-0 lg:grow-0 lg:basis-11"
            : "lg:w-[280px] lg:min-w-[260px] lg:shrink-0 lg:grow-0 lg:basis-[280px]",
        isOver && "border-ice/40 glow-ice"
      )}
      aria-label={`${stage.name}, ${itemCount} ${
        itemCount === 1 ? "item" : "items"
      }`}
    >
      {/* Stage hue wash. Stages run ice → white → amber across the pipeline,
          so the board reads cold-to-warm left to right instead of as seven
          identical dark boxes. Kept very low alpha — identity, not decoration. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40"
        style={{
          background: `linear-gradient(180deg, ${hue}14 0%, ${hue}05 45%, transparent 100%)`,
        }}
      />

      {collapsed && !fillAvailable ? (
        /* Collapsed: a single-line bar when stacked, a slim vertical rail
           (~44px) when columns sit side by side. */
        <div className="relative flex flex-1 items-center gap-2 px-3.5 py-2.5 lg:flex-col lg:gap-3 lg:px-0 lg:py-3">
          {/* Slit as a short rounded tick — a full-bleed bar reads as a broken
              edge against the panel's corner radius. */}
          <LfWindow
            className="relative hidden h-[2px] w-4 shrink-0 overflow-hidden rounded-full lg:block"
            aria-hidden
          >
            <span
              className="absolute inset-0 opacity-70 mix-blend-overlay"
              style={{ backgroundColor: hue }}
            />
          </LfWindow>
          <span className="order-1 font-display text-xs font-medium tracking-tight text-text-lo/70 lg:order-2 lg:[text-orientation:mixed] lg:[writing-mode:vertical-rl]">
            {stage.name}
          </span>
          <span className="order-2 ml-auto font-mono text-[10px] tabular-nums text-text-lo/40 lg:order-1 lg:ml-0">
            0
          </span>
        </div>
      ) : (
        <>
          <header className="relative px-3.5 pt-3.5 pb-3">
            <div className="flex items-center gap-2">
              <h2 className="min-w-0 flex-1 truncate font-display text-sm font-semibold tracking-tight text-text-hi">
                {stage.name}
              </h2>
              <span
                className={cn(
                  "rounded-chip px-1.5 py-0.5 font-mono text-[10px] tabular-nums",
                  itemCount > 0 ? "bg-bg-3 text-text-hi" : "text-text-lo/50"
                )}
              >
                {itemCount}
              </span>
              {onStageAdd ? (
                <StageAddMenu
                  stageName={stage.name}
                  onAction={onStageAdd}
                />
              ) : null}
            </div>
            {/* The divider *is* the design element now: a rounded lightfield
                slit tinted by stage hue, inset by the header padding so it
                never collides with the panel's corner radius. */}
            <LfWindow
              className="relative mt-3 h-[2px] w-full overflow-hidden rounded-full"
              aria-hidden
            >
              <span
                className="absolute inset-0 opacity-60 mix-blend-overlay"
                style={{ backgroundColor: hue }}
              />
            </LfWindow>
          </header>

          <div
            className={cn(
              "relative flex flex-1 flex-col px-2.5 pb-3",
              compact ? "gap-1" : "gap-2",
              isOver && "bg-ice/[0.03]"
            )}
          >
            {itemCount === 0 ? (
              <div
                className={cn(
                  "flex min-h-[112px] flex-1 items-center justify-center rounded-card border border-dashed px-3 text-center transition-colors duration-hover",
                  isOver
                    ? "border-ice/50 bg-ice/[0.06]"
                    : "border-line/70 bg-bg-0/30"
                )}
              >
                <p className="text-[11px] leading-relaxed text-text-lo/70">
                  {isOver ? (
                    <span className="text-ice">Drop to move here</span>
                  ) : (
                    "Drop a track or note here"
                  )}
                </p>
              </div>
            ) : (
              <>
                {notes.map((note) => (
                  <BoardNoteCard
                    key={note.id}
                    note={note}
                    compact={compact}
                    onSave={(patch) => onSaveNote?.(note, patch)}
                    onDelete={() => onDeleteNote?.(note)}
                  />
                ))}
                {visibleTracks.map((track) => (
                  <TrackCard
                    key={track.id}
                    track={track}
                    onOpen={onOpenTrack}
                    compact={compact}
                    roomy={roomy}
                    onRemoveFromBoard={onRemoveFromBoard}
                  />
                ))}
                {hiddenCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowAll(true)}
                    className="rounded-card border border-dashed border-line/70 bg-bg-0/30 px-3 py-2 text-center text-[11px] font-medium text-text-lo/70 transition-colors duration-hover hover:border-ice/40 hover:text-text-hi"
                  >
                    Show {hiddenCount} more
                  </button>
                ) : showAll && tracks.length > TRACK_CAP ? (
                  <button
                    type="button"
                    onClick={() => setShowAll(false)}
                    className="rounded-card border border-dashed border-line/70 bg-bg-0/30 px-3 py-2 text-center text-[11px] font-medium text-text-lo/70 transition-colors duration-hover hover:border-ice/40 hover:text-text-hi"
                  >
                    Show less
                  </button>
                ) : null}
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
