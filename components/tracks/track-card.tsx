"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import * as React from "react";
import { AlertTriangle, Clock } from "lucide-react";
import { SignedImage } from "@/components/ui/signed-image";
import { LfWindow } from "@/components/lf-windows";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import type { Track } from "@/lib/types";
import {
  formatTrackType,
  gradientFromTrackId,
  momentumDotClass,
  typeChipClass,
} from "@/lib/track-style";
import { cn } from "@/lib/utils";

type TrackCardProps = {
  track: Track;
  onOpen: (track: Track) => void;
  isDragOverlay?: boolean;
  compact?: boolean;
  /** Sparse board — larger artwork and title so cards carry the column. */
  roomy?: boolean;
};

export function TrackCard({
  track,
  onOpen,
  isDragOverlay,
  compact,
  roomy,
}: TrackCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: track.id,
      data: { track },
      disabled: isDragOverlay,
    });
  const [hovered, setHovered] = React.useState(false);

  const style = isDragOverlay
    ? undefined
    : {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.35 : 1,
      };

  const metaParts: string[] = [];
  if (track.bpm != null) metaParts.push(`${track.bpm} BPM`);
  if (track.musical_key) metaParts.push(track.musical_key);

  const deadlineLabel = track.deadline
    ? new Date(track.deadline + "T12:00:00").toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : null;

  const overdue =
    !!track.deadline &&
    new Date(track.deadline + "T23:59:59") < new Date() &&
    track.momentum !== "parked";

  const nextActionOverdue =
    !!track.next_action?.trim() &&
    !!track.next_action_due &&
    new Date(track.next_action_due + "T23:59:59") < new Date();

  const topSignal = track.blocked_reason?.trim()
    ? { Icon: AlertTriangle, label: "Blocked" }
    : nextActionOverdue
      ? { Icon: Clock, label: "Next move overdue" }
      : null;

  const showEdge = hovered && !isDragging && !isDragOverlay;

  return (
    <article
      ref={isDragOverlay ? undefined : setNodeRef}
      style={style}
      className={cn(
        "relative rounded-card p-px transition-[box-shadow,opacity] duration-hover",
        isDragOverlay && "cursor-grabbing shadow-raise",
        isDragging && !isDragOverlay && "opacity-40"
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Shader frame on hover — the card's edge becomes a window onto the
          lightfield. The spotlight below rides on top of it, it doesn't
          replace it. */}
      <LfWindow
        enabled={showEdge}
        className="absolute inset-0 rounded-card"
        aria-hidden
      />
      <SpotlightCard
        tone={topSignal ? "warn" : "ramp"}
        radius={10}
        size={200}
        className="block h-full"
      >
      <div
        className={cn(
          "relative rounded-[9px] border border-line",
          "bg-gradient-to-b from-[#17171e] to-bg-1 shadow-e1",
          "transition-shadow duration-hover",
          !isDragOverlay && !isDragging && "hover:shadow-e2",
          compact ? "p-2" : roomy ? "p-3.5" : "p-3",
          isDragOverlay && "ring-1 ring-ice/60"
        )}
      >
        <div className="flex gap-3">
          <button
            type="button"
            className={cn(
              "relative shrink-0 overflow-hidden rounded-input border border-line",
              roomy ? "size-16 shadow-e1" : "size-11"
            )}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onOpen(track)}
            aria-label={`Open ${track.title}`}
          >
            <span
              className="absolute inset-0 block size-full"
              style={{ background: gradientFromTrackId(track.id) }}
            />
            <SignedImage
              path={track.artwork_url}
              className="absolute inset-0 size-full"
            />
          </button>

          <div
            className={cn(
              "min-w-0 flex-1",
              !isDragOverlay && "cursor-grab active:cursor-grabbing touch-none"
            )}
            {...(isDragOverlay ? {} : { ...listeners, ...attributes })}
          >
            <div className="flex items-start justify-between gap-2">
              <button
                type="button"
                className="min-w-0 text-left"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onOpen(track)}
              >
                <h3
                  className={cn(
                    "truncate font-medium text-text-hi hover:text-ice",
                    roomy ? "text-base" : "text-sm"
                  )}
                >
                  {track.title}
                </h3>
              </button>
              <span className="mt-0.5 flex shrink-0 items-center gap-1">
                {topSignal ? (
                  <span title={topSignal.label} aria-label={topSignal.label}>
                    <topSignal.Icon className="size-3 text-warn" aria-hidden />
                  </span>
                ) : null}
                <span
                  className={cn(
                    "size-2 rounded-full",
                    momentumDotClass(track.momentum)
                  )}
                  title={track.momentum}
                  aria-label={`Momentum: ${track.momentum}`}
                />
              </span>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "rounded-chip px-2 py-0.5 text-[11px]",
                  typeChipClass(track.type)
                )}
              >
                {formatTrackType(track.type)}
              </span>
              {metaParts.length > 0 ? (
                <span className="font-mono text-[11px] text-text-lo">
                  {metaParts.join(" · ")}
                </span>
              ) : null}
            </div>

            {track.next_action?.trim() ? (
              <p
                className={cn(
                  "mt-1.5 truncate text-[11px]",
                  nextActionOverdue ? "text-warn" : "text-text-lo"
                )}
              >
                <span className="text-text-lo/70">Next: </span>
                {track.next_action}
              </p>
            ) : null}

            {deadlineLabel ? (
              <p
                className={cn(
                  "mt-1 font-mono text-[11px]",
                  overdue ? "text-warn" : "text-text-lo"
                )}
              >
                {deadlineLabel}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      </SpotlightCard>
    </article>
  );
}
