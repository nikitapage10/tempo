"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import type { DropSlot } from "@/lib/dnd/drop-slot";
import { dropSlotId } from "@/lib/dnd/drop-slot";

export function DropIndicator({
  slot,
  active,
  disabled,
}: {
  slot: DropSlot;
  active: boolean;
  disabled?: boolean;
}) {
  const id = dropSlotId(slot);
  const { setNodeRef } = useDroppable({
    id,
    disabled,
    data: { slot, containerId: slot.containerId },
  });

  return (
    <div
      ref={setNodeRef}
      data-drop-slot={id}
      aria-hidden
      className={cn(
        "relative z-10 h-3 shrink-0 -my-1.5",
        disabled && "pointer-events-none"
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-ice shadow-[0_0_10px_color-mix(in_srgb,var(--ice)_70%,transparent)] transition-opacity duration-150",
          active ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
}
