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
  /** Sparse board — render cards with more presence. */
  roomy?: boolean;
  /** A card is currently being dragged — expand every stage so all are droppable. */
  dragging?: boolean;
  /** False when nothing is on the board at all, so we don't collapse every column to a rail. */
  allowCollapse?: boolean;
};

export function KanbanColumn({
  stage,
  tracks,
  stages,
  isOver,
  onOpenTrack,
  compact,
  roomy,
  dragging,
  allowCollapse = true,
}: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: stage.id,
    data: { stage },
  });

  const progress = stageProgressFromSort(stage.sort, stages);
  const hue = stageHueAt(progress);

  // Empty stages give their width back to stages that actually hold work —
  // this is what keeps the whole pipeline on screen without horizontal scroll.
  const collapsed =
    allowCollapse && tracks.length === 0 && !dragging && !isOver;

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "relative flex flex-col overflow-hidden rounded-panel border border-line",
        "bg-gradient-to-b from-[#141419] to-[#0e0e12] shadow-e2",
        "transition-[flex-grow,flex-basis,border-color,box-shadow] duration-300 ease-out motion-reduce:transition-none",
        // Stacked full-width below lg; sized columns from lg up.
        "w-full lg:min-h-[220px] lg:w-auto",
        collapsed
          ? "lg:w-11 lg:shrink-0 lg:grow-0 lg:basis-11"
          : "lg:min-w-[164px] lg:shrink lg:grow lg:basis-[280px]",
        isOver && "border-ice/40 glow-ice"
      )}
      aria-label={`${stage.name}, ${tracks.length} ${
        tracks.length === 1 ? "track" : "tracks"
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

      {collapsed ? (
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
              <h2 className="truncate font-display text-sm font-semibold tracking-tight text-text-hi">
                {stage.name}
              </h2>
              <span
                className={cn(
                  "rounded-chip px-1.5 py-0.5 font-mono text-[10px] tabular-nums",
                  tracks.length > 0 ? "bg-bg-3 text-text-hi" : "text-text-lo/50"
                )}
              >
                {tracks.length}
              </span>
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
              "relative flex flex-1 flex-col gap-2 px-2.5 pb-3",
              isOver && "bg-ice/[0.03]"
            )}
          >
            {tracks.length === 0 ? (
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
                    "Drop a track here"
                  )}
                </p>
              </div>
            ) : (
              tracks.map((track) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  onOpen={onOpenTrack}
                  compact={compact}
                  roomy={roomy}
                />
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
}
