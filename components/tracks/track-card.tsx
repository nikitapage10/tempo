"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { SignedImage } from "@/components/ui/signed-image";
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
};

export function TrackCard({ track, onOpen, isDragOverlay }: TrackCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: track.id,
      data: { track },
      disabled: isDragOverlay,
    });

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

  return (
    <article
      ref={isDragOverlay ? undefined : setNodeRef}
      style={style}
      className={cn(
        "rounded-card border border-line bg-bg-1 p-3 transition-[box-shadow,opacity] duration-hover",
        isDragOverlay && "cursor-grabbing shadow-raise ring-1 ring-ice/60",
        isDragging && !isDragOverlay && "ring-1 ring-ice/40"
      )}
    >
      <div className="flex gap-3">
        <button
          type="button"
          className="relative size-11 shrink-0 overflow-hidden rounded-input border border-line"
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
              <h3 className="truncate text-sm font-medium text-text-hi hover:text-ice">
                {track.title}
              </h3>
            </button>
            <span
              className={cn(
                "mt-1 size-2 shrink-0 rounded-full",
                momentumDotClass(track.momentum)
              )}
              title={track.momentum}
              aria-label={`Momentum: ${track.momentum}`}
            />
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

          {deadlineLabel ? (
            <p
              className={cn(
                "mt-1.5 font-mono text-[11px]",
                overdue ? "text-warn" : "text-text-lo"
              )}
            >
              {deadlineLabel}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
