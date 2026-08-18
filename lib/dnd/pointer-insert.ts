import {
  closestCorners,
  pointerWithin,
  type Collision,
  type CollisionDetection,
} from "@dnd-kit/core";
import type { DropSlot, DropSlotKind } from "@/lib/dnd/drop-slot";
import { dropSlotId } from "@/lib/dnd/drop-slot";

export function pointerFromDragEvent(
  event: {
    activatorEvent: Event;
    delta: { x: number; y: number };
  }
): { x: number; y: number } | null {
  const activator = event.activatorEvent;
  if (!(activator instanceof MouseEvent)) {
    return null;
  }
  return {
    x: activator.clientX + event.delta.x,
    y: activator.clientY + event.delta.y,
  };
}

export type ItemRect = { id: string; top: number; height: number };

/** First item whose top half is below the pointer; otherwise the end of the list. */
export function insertBeforeIdFromPointer(
  items: ItemRect[],
  pointerY: number,
  excludeId?: string | null
): string | null {
  const ordered = [...items]
    .filter((item) => item.id !== excludeId)
    .sort((a, b) => a.top - b.top || a.id.localeCompare(b.id));
  for (const item of ordered) {
    if (item.height <= 0) continue;
    if (pointerY < item.top + item.height / 2) return item.id;
  }
  return null;
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

export function itemTargetId(kind: DropSlotKind, itemId: string): string {
  return `drop-${kind}:${itemId}`;
}

function kindFromActiveData(kind: unknown): DropSlotKind | null {
  if (kind === "track" || kind === "note" || kind === "task" || kind === "pro") {
    return kind;
  }
  if (kind === "pro-flow-card") return "pro";
  return null;
}

function columnIdFromData(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const value = data as {
    containerId?: unknown;
    stageId?: unknown;
    bucket?: unknown;
    stage?: { id?: unknown };
  };
  if (typeof value.containerId === "string") return value.containerId;
  if (typeof value.stageId === "string") return value.stageId;
  if (typeof value.bucket === "string") return value.bucket;
  if (typeof value.stage?.id === "string") return value.stage.id;
  return null;
}

function activeItemId(kind: DropSlotKind, activeId: string): string | null {
  if (kind === "track") return activeId;
  if (kind === "note") {
    return activeId.startsWith("note:") ? activeId.slice(5) : activeId;
  }
  if (kind === "task") {
    return activeId.startsWith("task:") ? activeId.slice(5) : activeId;
  }
  if (kind === "pro") {
    return activeId.startsWith("pro-flow-card:")
      ? activeId.slice(14)
      : activeId;
  }
  return activeId;
}

function pointInRect(
  point: { x: number; y: number },
  rect: { left: number; right: number; top: number; bottom: number }
) {
  return (
    point.x >= rect.left &&
    point.x <= rect.right &&
    point.y >= rect.top &&
    point.y <= rect.bottom
  );
}

function collisionFor(container: {
  id: string | number;
  data: { current?: unknown };
}): Collision {
  return {
    id: container.id,
    data: { droppableContainer: container, value: 0 },
  };
}

function fallbackCollisions(
  args: Parameters<CollisionDetection>[0]
): Collision[] {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length === 0) return closestCorners(args);
  const slots = pointerHits.filter((hit) => isDropSlotId(String(hit.id)));
  if (slots.length > 0) return slots;
  return pointerHits;
}

/**
 * Prefer a real insert slot from card top/bottom halves over the whole column,
 * so a drop between two items does not snap to the start or end of the list.
 */
export const listInsertCollision: CollisionDetection = (args) => {
  const kind = kindFromActiveData(args.active.data.current?.kind);
  const pointer = args.pointerCoordinates;
  if (!kind || !pointer) return fallbackCollisions(args);

  let column: { id: string; containerId: string; area: number } | null = null;
  for (const container of args.droppableContainers) {
    const id = String(container.id);
    if (isDropSlotId(id) || id.startsWith("drop-")) continue;
    const containerId = columnIdFromData(container.data.current);
    if (!containerId) continue;
    const rect = args.droppableRects.get(container.id);
    if (!rect || !pointInRect(pointer, rect)) continue;
    const area = Math.max(1, rect.width * rect.height);
    if (!column || area < column.area) {
      column = { id, containerId, area };
    }
  }
  if (!column) return fallbackCollisions(args);

  const prefix = `drop-${kind}:`;
  const items: ItemRect[] = [];
  for (const container of args.droppableContainers) {
    const id = String(container.id);
    if (!id.startsWith(prefix)) continue;
    const itemContainerId = columnIdFromData(container.data.current);
    if (itemContainerId && itemContainerId !== column.containerId) continue;
    const rect = args.droppableRects.get(container.id);
    if (!rect || rect.height <= 0) continue;
    items.push({
      id: id.slice(prefix.length),
      top: rect.top,
      height: rect.height,
    });
  }

  const beforeId = insertBeforeIdFromPointer(
    items,
    pointer.y,
    activeItemId(kind, String(args.active.id))
  );
  const slotId = dropSlotId({
    kind,
    containerId: column.containerId,
    beforeId,
  });
  const slotContainer = args.droppableContainers.find(
    (container) => String(container.id) === slotId
  );
  if (slotContainer) return [collisionFor(slotContainer)];

  const columnContainer = args.droppableContainers.find(
    (container) => String(container.id) === column.id
  );
  if (columnContainer) return [collisionFor(columnContainer)];
  return fallbackCollisions(args);
};
