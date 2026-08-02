"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { ChevronDown, ChevronUp, GripVertical, Pencil, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { SignedImage } from "@/components/ui/signed-image";
import type { TrackGroupAccent } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * How each tint paints.
 *
 * A wash rather than a fill: the surface stays in the Spectra dark family and
 * the colour reads as a label on the group, not as a coloured box. The left
 * rule is what actually does the distinguishing at a glance — the background is
 * only there to bind the tracks to their header.
 */
const ACCENT_SURFACE: Record<TrackGroupAccent, string> = {
  ice: "border-ice/25 bg-ice/[0.045]",
  amber: "border-amber/25 bg-amber/[0.045]",
  violet: "border-violet/25 bg-violet/[0.045]",
  ok: "border-ok/25 bg-ok/[0.045]",
  warn: "border-warn/25 bg-warn/[0.045]",
};

const ACCENT_RULE: Record<TrackGroupAccent, string> = {
  ice: "bg-ice/70",
  amber: "bg-amber/70",
  violet: "bg-violet/70",
  ok: "bg-ok/70",
  warn: "bg-warn/70",
};

export const UNGROUPED_DROP_ID = "drop:ungrouped";

export function groupDropId(groupId: string): string {
  return `drop:group:${groupId}`;
}

export function parseGroupDropId(overId: string): string | null | undefined {
  if (overId === UNGROUPED_DROP_ID) return null;
  if (overId.startsWith("drop:group:")) return overId.slice("drop:group:".length);
  return undefined;
}

/**
 * A group being dragged by its own handle, as opposed to a track.
 *
 * Deliberately a plain draggable rather than a second sortable list: the tracks
 * inside are already a sortable context, and nesting a second strategy over the
 * same rects makes both of them measure the wrong thing. Groups reorder on drop
 * against whichever group they were released over.
 */
export const GROUP_SORT_PREFIX = "sort:group:";

export function groupSortId(groupId: string): string {
  return `${GROUP_SORT_PREFIX}${groupId}`;
}

export function parseGroupSortId(activeId: string): string | null {
  return activeId.startsWith(GROUP_SORT_PREFIX)
    ? activeId.slice(GROUP_SORT_PREFIX.length)
    : null;
}

type TrackGroupSectionProps = {
  dropId: string;
  /**
   * Omitted for the ungrouped run of tracks, which gets no heading at all —
   * it isn't a group, so naming it invented a container that doesn't exist.
   */
  title?: string;
  /** Present only for real groups: the id this section drags under. */
  sortId?: string;
  /** Optional album/EP image, as a storage path. */
  coverUrl?: string | null;
  accent?: TrackGroupAccent | null;
  count: number;
  canDrag: boolean;
  densityClass?: string;
  isOver?: boolean;
  onRename?: () => void;
  onDelete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  children: ReactNode;
};

export function TrackGroupSection({
  dropId,
  title,
  sortId,
  coverUrl,
  accent,
  count,
  canDrag,
  densityClass = "space-y-2",
  isOver,
  onRename,
  onDelete,
  onMoveUp,
  onMoveDown,
  children,
}: TrackGroupSectionProps) {
  const { setNodeRef, isOver: droppableOver } = useDroppable({
    id: dropId,
    disabled: !canDrag,
  });

  const canReorderGroup = Boolean(sortId) && canDrag;
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    isDragging,
  } = useDraggable({
    // Every draggable needs a stable unique id even while it is switched off.
    id: sortId ?? `${dropId}:static`,
    disabled: !canReorderGroup,
  });

  const highlight = isOver || droppableOver;

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "relative rounded-card border border-transparent transition-colors duration-hover",
        // A tinted group is a container you can see the edges of; an untinted
        // one keeps the old flush look so nothing changes for existing groups.
        accent ? cn("px-3 py-2.5", ACCENT_SURFACE[accent]) : null,
        highlight && "border-ice/30 bg-ice/[0.03]",
        isDragging && "opacity-40"
      )}
    >
      {accent ? (
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-2 left-0 w-[2px] rounded-full",
            ACCENT_RULE[accent]
          )}
        />
      ) : null}
      {title ? (
      <header className="mb-1.5 flex items-center gap-2 px-0.5">
        {canReorderGroup ? (
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...listeners}
            {...attributes}
            aria-label={`Reorder ${title}`}
            className="-ml-1 shrink-0 cursor-grab touch-none rounded-input p-1 text-text-lo/60 hover:text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice active:cursor-grabbing"
          >
            <GripVertical className="size-3.5" />
          </button>
        ) : null}
        {coverUrl ? (
          <SignedImage
            path={coverUrl}
            alt=""
            className="size-9 shrink-0 rounded-input object-cover"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h2 className="truncate font-display text-sm font-medium tracking-tight text-text-hi">
              {title}
            </h2>
            <span className="font-data shrink-0 text-[10px] text-text-lo/70">
              {count}
            </span>
          </div>
          <div className="flare-line mt-1 opacity-70" />
        </div>

        {(onMoveUp || onMoveDown || onRename || onDelete) && (
          <div className="flex shrink-0 items-center gap-0.5">
            {onMoveUp ? (
              <button
                type="button"
                aria-label={`Move ${title} up`}
                onClick={onMoveUp}
                className="rounded-input p-1 text-text-lo hover:text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
              >
                <ChevronUp className="size-3.5" />
              </button>
            ) : null}
            {onMoveDown ? (
              <button
                type="button"
                aria-label={`Move ${title} down`}
                onClick={onMoveDown}
                className="rounded-input p-1 text-text-lo hover:text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
              >
                <ChevronDown className="size-3.5" />
              </button>
            ) : null}
            {onRename ? (
              <button
                type="button"
                aria-label={`Rename ${title}`}
                onClick={onRename}
                className="rounded-input p-1 text-text-lo hover:text-text-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
              >
                <Pencil className="size-3.5" />
              </button>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                aria-label={`Delete ${title}`}
                onClick={onDelete}
                className="rounded-input p-1 text-text-lo hover:text-warn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
              >
                <Trash2 className="size-3.5" />
              </button>
            ) : null}
          </div>
        )}
      </header>
      ) : null}

      <ul
        className={cn(
          densityClass,
          count === 0 &&
            canDrag &&
            "rounded-input border border-dashed border-line/50"
        )}
      >
        {count === 0 ? (
          canDrag ? (
            <li className="px-3 py-4 text-center text-[11px] text-text-lo/60">
              Drop tracks here
            </li>
          ) : title ? (
            <li className="px-3 py-3 text-center text-[11px] text-text-lo/50">
              No tracks in this group
            </li>
          ) : null
        ) : (
          children
        )}
      </ul>
    </section>
  );
}
