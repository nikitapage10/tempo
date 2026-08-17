import type { DragOverEvent } from "@dnd-kit/core";
import type { DropSlot } from "@/lib/dnd/drop-slot";

export function pointerFromDragEvent(
  event: Pick<DragOverEvent, "activatorEvent" | "delta">
): { x: number; y: number } | null {
  const activator = event.activatorEvent;
  if (!activator || !("clientX" in activator) || !("clientY" in activator)) {
    return null;
  }
  return {
    x: activator.clientX + event.delta.x,
    y: activator.clientY + event.delta.y,
  };
}

/** When the pointer is over a card, use top/bottom half to pick insert before vs after. */
export function refineTrackInsertSlot(
  slot: DropSlot,
  orderedTrackIds: string[],
  pointer: { y: number } | null,
  overRect: { top: number; height: number } | null,
  hoveredTrackId: string | null
): DropSlot {
  if (
    slot.kind !== "track" ||
    !hoveredTrackId ||
    !pointer ||
    !overRect ||
    overRect.height <= 0
  ) {
    return slot;
  }

  const index = orderedTrackIds.indexOf(hoveredTrackId);
  if (index < 0) return slot;

  const mid = overRect.top + overRect.height / 2;
  if (pointer.y > mid) {
    return {
      ...slot,
      beforeId: orderedTrackIds[index + 1] ?? null,
    };
  }

  return { ...slot, beforeId: hoveredTrackId };
}

export function isDropSlotId(id: string): boolean {
  return id.startsWith("slot:");
}
